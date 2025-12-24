import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, User } from "lucide-react";

interface SelfieCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (selfieBase64: string) => void;
  signerName: string;
  autoSign?: boolean;
}

export const SelfieCaptureDialog = ({
  open,
  onOpenChange,
  onCapture,
  signerName,
  autoSign = true,
}: SelfieCaptureDialogProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("Inicializando câmera...");
  const [isConfirming, setIsConfirming] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      setStatusMessage("Inicializando câmera...");
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsStreaming(true);
          setIsLoading(false);
          setStatusMessage("Posicione seu rosto no centro");
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Não foi possível acessar a câmera. Por favor, permita o acesso à câmera.");
      setIsLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Mirror the image horizontally for selfie effect
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
    stopCamera();
    stopDetection();
    
    // Auto-confirm after short preview
    setIsConfirming(true);
    setStatusMessage("Selfie capturada! Processando...");
    
    setTimeout(() => {
      // Extract base64 data (remove the data:image/jpeg;base64, prefix)
      const base64Data = dataUrl.split(",")[1];
      onCapture(base64Data);
      onOpenChange(false);
    }, 1500);
  }, [stopCamera, stopDetection, onCapture, onOpenChange]);

  // Simple face detection using canvas brightness analysis
  const detectFace = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return false;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context || video.videoWidth === 0) return false;

    // Use a smaller canvas for performance
    const width = 160;
    const height = 120;
    canvas.width = width;
    canvas.height = height;
    
    context.drawImage(video, 0, 0, width, height);
    
    // Get the center region where face should be
    const centerX = width * 0.3;
    const centerY = height * 0.15;
    const faceWidth = width * 0.4;
    const faceHeight = height * 0.7;
    
    try {
      const imageData = context.getImageData(centerX, centerY, faceWidth, faceHeight);
      const data = imageData.data;
      
      let skinPixels = 0;
      let totalPixels = 0;
      
      // Detect skin-tone pixels (simple heuristic)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Check if pixel looks like skin (simplified detection)
        // This works for various skin tones by checking relative values
        if (r > 60 && g > 40 && b > 20 && 
            r > g && g > b * 0.6 && 
            Math.abs(r - g) < 100 &&
            r - b > 15) {
          skinPixels++;
        }
        totalPixels++;
      }
      
      const skinRatio = skinPixels / totalPixels;
      
      // If at least 15% of center area is skin-like, assume face detected
      return skinRatio > 0.15;
    } catch {
      return false;
    }
  }, []);

  // Start face detection when streaming
  useEffect(() => {
    if (!isStreaming || capturedImage) return;

    let consecutiveDetections = 0;
    const requiredConsecutive = 5; // Need 5 consecutive positive detections

    detectionIntervalRef.current = setInterval(() => {
      const detected = detectFace();
      
      if (detected) {
        consecutiveDetections++;
        if (consecutiveDetections >= requiredConsecutive && !faceDetected) {
          setFaceDetected(true);
          setStatusMessage("Rosto detectado! Mantenha a posição...");
          setCountdown(3);
        }
      } else {
        consecutiveDetections = 0;
        if (faceDetected) {
          setFaceDetected(false);
          setCountdown(null);
          setStatusMessage("Posicione seu rosto no centro");
        }
      }
    }, 200);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [isStreaming, capturedImage, detectFace, faceDetected]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0 || !faceDetected) return;

    countdownIntervalRef.current = setTimeout(() => {
      if (countdown === 1) {
        capturePhoto();
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearTimeout(countdownIntervalRef.current);
      }
    };
  }, [countdown, faceDetected, capturePhoto]);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      stopDetection();
      setCapturedImage(null);
      setError(null);
      setFaceDetected(false);
      setCountdown(null);
      setIsConfirming(false);
      setStatusMessage("Inicializando câmera...");
    }
    
    return () => {
      stopCamera();
      stopDetection();
    };
  }, [open, startCamera, stopCamera, stopDetection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Captura de Biometria Facial</DialogTitle>
          <DialogDescription>
            {signerName}, posicione seu rosto centralizado na câmera. A foto será capturada automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div className="text-center p-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="text-destructive text-sm mb-4">{error}</p>
              <Button onClick={startCamera} variant="outline">
                Tentar Novamente
              </Button>
            </div>
          ) : capturedImage ? (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                <img
                  src={capturedImage}
                  alt="Selfie capturada"
                  className="w-full h-full object-cover"
                />
                {isConfirming && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="text-center text-white">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p className="text-sm font-medium">{statusMessage}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{statusMessage}</p>
                    </div>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                />
                {/* Face guide overlay */}
                {isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {/* Oval face guide */}
                    <div 
                      className={`border-2 border-dashed rounded-full transition-colors duration-300 ${
                        faceDetected ? 'border-green-500' : 'border-white/60'
                      }`}
                      style={{ width: "60%", height: "80%", maxWidth: "200px", maxHeight: "260px" }}
                    />
                    
                    {/* Countdown overlay */}
                    {countdown !== null && countdown > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/50 rounded-full w-24 h-24 flex items-center justify-center">
                          <span className="text-white text-5xl font-bold">{countdown}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Status message */}
              {isStreaming && (
                <div className={`text-center py-2 px-4 rounded-lg ${
                  faceDetected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  <div className="flex items-center justify-center gap-2">
                    {faceDetected ? (
                      <>
                        <User className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {countdown !== null ? `Capturando em ${countdown}...` : statusMessage}
                        </span>
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4" />
                        <span className="text-sm font-medium">{statusMessage}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
};
