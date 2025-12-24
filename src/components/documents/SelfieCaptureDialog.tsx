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
import * as faceapi from "face-api.js";

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
}: SelfieCaptureDialogProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<number | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);

  const [faceDetected, setFaceDetected] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("Inicializando câmera...");
  const [isConfirming, setIsConfirming] = useState(false);

  // Load face-api models once
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        if (!cancelled) setModelsReady(true);
      } catch (e) {
        console.error("Failed to load face models:", e);
        if (!cancelled) {
          setError(
            "Não foi possível carregar o detector facial. Recarregue a página e tente novamente."
          );
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      window.clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    stopDetection();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, [stopDetection]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      setStatusMessage("Abrindo câmera...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
          } catch (e) {
            console.warn("Video play blocked:", e);
          }
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

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!video.videoWidth || !video.videoHeight) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Mirror selfie
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);

    stopCamera();
    setIsConfirming(true);
    setStatusMessage("Selfie capturada! Processando...");

    window.setTimeout(() => {
      const base64Data = dataUrl.split(",")[1];
      onCapture(base64Data);
      onOpenChange(false);
    }, 1200);
  }, [onCapture, onOpenChange, stopCamera]);

  const detectOnce = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !modelsReady) return false;
    if (!video.videoWidth || !video.videoHeight) return false;

    const detection = await faceapi.detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
    );

    return Boolean(detection);
  }, [modelsReady]);

  // Start detection loop when streaming
  useEffect(() => {
    if (!open) return;
    if (!isStreaming) return;
    if (capturedImage) return;
    if (!modelsReady) {
      setStatusMessage("Carregando detector facial...");
      return;
    }

    let stable = 0;
    const requiredStable = 4; // ~0.8s with 200ms interval

    stopDetection();
    detectionIntervalRef.current = window.setInterval(async () => {
      try {
        const ok = await detectOnce();

        if (ok) {
          stable++;
          if (stable >= requiredStable && !faceDetected) {
            setFaceDetected(true);
            setCountdown(3);
            setStatusMessage("Rosto detectado! Mantenha a posição...");
          }
        } else {
          stable = 0;
          if (faceDetected) {
            setFaceDetected(false);
            setCountdown(null);
            setStatusMessage("Posicione seu rosto no centro");
          }
        }
      } catch (e) {
        console.error("Face detection error:", e);
      }
    }, 200);

    return () => {
      stopDetection();
    };
  }, [open, isStreaming, capturedImage, modelsReady, detectOnce, faceDetected, stopDetection]);

  // Countdown: when reaches 0, capture automatically
  useEffect(() => {
    if (!open) return;
    if (!faceDetected) return;
    if (countdown === null) return;

    if (countdown <= 0) return;

    const t = window.setTimeout(() => {
      if (countdown === 1) {
        capturePhoto();
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);

    return () => window.clearTimeout(t);
  }, [open, faceDetected, countdown, capturePhoto]);

  useEffect(() => {
    if (open) {
      setCapturedImage(null);
      setFaceDetected(false);
      setCountdown(null);
      setIsConfirming(false);
      setStatusMessage("Inicializando câmera...");
      if (!error) startCamera();
    } else {
      stopCamera();
      stopDetection();
      setCapturedImage(null);
      setFaceDetected(false);
      setCountdown(null);
      setIsConfirming(false);
      setStatusMessage("Inicializando câmera...");
      setError(null);
    }

    return () => {
      stopCamera();
      stopDetection();
    };
  }, [open, startCamera, stopCamera, stopDetection, error]);

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
              <Button
                onClick={() => {
                  setError(null);
                  startCamera();
                }}
                variant="outline"
              >
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

                {isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className={`border-2 border-dashed rounded-full transition-colors duration-300 ${
                        faceDetected ? "border-primary" : "border-border/60"
                      }`}
                      style={{
                        width: "60%",
                        height: "80%",
                        maxWidth: "200px",
                        maxHeight: "260px",
                      }}
                    />

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

              {isStreaming && (
                <div className="text-center py-2 px-4 rounded-lg bg-muted">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {faceDetected
                        ? countdown !== null
                          ? `Capturando em ${countdown}...`
                          : statusMessage
                        : statusMessage}
                    </span>
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
