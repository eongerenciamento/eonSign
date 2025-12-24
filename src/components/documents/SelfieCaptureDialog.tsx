import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, Loader2 } from "lucide-react";

interface SelfieCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (selfieBase64: string) => void;
  signerName: string;
}

export const SelfieCaptureDialog = ({
  open,
  onOpenChange,
  onCapture,
  signerName,
}: SelfieCaptureDialogProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      
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
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  const confirmPhoto = useCallback(() => {
    if (capturedImage) {
      // Extract base64 data (remove the data:image/jpeg;base64, prefix)
      const base64Data = capturedImage.split(",")[1];
      onCapture(base64Data);
      onOpenChange(false);
    }
  }, [capturedImage, onCapture, onOpenChange]);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
      setError(null);
    }
    
    return () => {
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Captura de Biometria Facial</DialogTitle>
          <DialogDescription>
            {signerName}, posicione seu rosto centralizado na câmera e tire uma foto clara.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div className="text-center p-8">
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
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={retakePhoto}
                  variant="outline"
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Tirar Outra
                </Button>
                <Button
                  onClick={confirmPhoto}
                  className="flex-1 bg-gradient-to-r from-[#273d60] to-[#001a4d]"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
                    <div 
                      className="border-2 border-dashed border-white/60 rounded-full"
                      style={{ width: "60%", height: "80%", maxWidth: "200px", maxHeight: "260px" }}
                    />
                  </div>
                )}
              </div>
              <Button
                onClick={capturePhoto}
                disabled={!isStreaming}
                className="w-full bg-gradient-to-r from-[#273d60] to-[#001a4d]"
              >
                <Camera className="w-4 h-4 mr-2" />
                Capturar Foto
              </Button>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
};
