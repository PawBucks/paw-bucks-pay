import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

type QRScannerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ScanResult = {
  success: boolean;
  entityName: string | null;
  message: string;
};

export function QRScannerDialog({ open, onOpenChange }: QRScannerDialogProps) {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerRef.current.stop();
        }
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const processToken = useCallback(async (token: string) => {
    if (!user || processing) return;
    setProcessing(true);
    
    try {
      await stopScanner();
      
      const { data, error } = await supabase.rpc("process_checkin", {
        p_token: token,
        p_user_id: user.id,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setResult({
          success: row.success,
          entityName: row.entity_name,
          message: row.message,
        });
        if (row.success) {
          toast.success(`Checked in at ${row.entity_name}!`);
        } else {
          toast.info(row.message);
        }
      }
    } catch (error) {
      console.error("Check-in error:", error);
      setResult({ success: false, entityName: null, message: "Failed to process check-in" });
      toast.error("Failed to check in");
    } finally {
      setProcessing(false);
    }
  }, [user, processing, stopScanner]);

  const startScanner = useCallback(async () => {
    setResult(null);
    setScanning(true);

    // Small delay to let DOM render
    await new Promise(r => setTimeout(r, 300));

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Extract token from URL or use raw
          let token = decodedText;
          try {
            const url = new URL(decodedText);
            const t = url.searchParams.get("token");
            if (t) token = t;
          } catch {
            // not a URL, use raw
          }
          processToken(token);
        },
        () => {
          // QR scan error (no code found) - ignore
        }
      );
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Could not access camera. Please allow camera permissions.");
      setScanning(false);
    }
  }, [processToken]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [stopScanner]);

  useEffect(() => {
    if (!open) {
      stopScanner();
      // Reset state when dialog closes
      setTimeout(() => {
        if (!mountedRef.current) return;
        setResult(null);
        setProcessing(false);
      }, 300);
    }
  }, [open, stopScanner]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Check In
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {result ? (
            <div className="text-center py-6 space-y-4">
              {result.success ? (
                <>
                  <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
                  <div>
                    <h3 className="text-lg font-semibold">Checked In!</h3>
                    <p className="text-muted-foreground">
                      Welcome to {result.entityName}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 mx-auto text-destructive" />
                  <div>
                    <h3 className="text-lg font-semibold">
                      {result.entityName ? `${result.entityName}` : "Check-In Failed"}
                    </h3>
                    <p className="text-muted-foreground">{result.message}</p>
                  </div>
                </>
              )}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button onClick={startScanner}>
                  Scan Again
                </Button>
              </div>
            </div>
          ) : processing ? (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary mb-3" />
              <p className="text-muted-foreground">Processing check-in...</p>
            </div>
          ) : scanning ? (
            <div>
              <div id="qr-reader" className="w-full rounded-lg overflow-hidden" />
              <p className="text-center text-xs text-muted-foreground mt-3">
                Point your camera at the QR code displayed at the location
              </p>
              <Button variant="outline" onClick={stopScanner} className="w-full mt-3">
                Cancel
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              <Camera className="w-16 h-16 mx-auto text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">
                  Scan a merchant or vet's QR code to check in
                </p>
              </div>
              <Button onClick={startScanner} className="w-full">
                <Camera className="w-4 h-4 mr-2" />
                Start Scanner
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
