import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { X, ScanLine } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Return a label to flash (e.g. item name) or null when not found. */
  onScan: (code: string) => string | null;
};

const FORMATS = [
  Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
];

function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = ok ? 1200 : 300; o.connect(g); g.connect(ctx.destination);
    g.gain.value = 0.1; o.start(); o.stop(ctx.currentTime + (ok ? 0.08 : 0.25));
  } catch { /* ignore */ }
  if (navigator.vibrate) navigator.vibrate(ok ? 40 : [60, 40, 60]);
}

export function BarcodeScannerModal({ open, onClose, onScan }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    const s = new Html5Qrcode("pos-scanner-region", { formatsToSupport: FORMATS, verbose: false });
    scannerRef.current = s;
    s.start(
      { facingMode: "environment" },
      { fps: 12, qrbox: (w, h) => ({ width: Math.min(w * 0.85, 420), height: Math.min(h * 0.35, 200) }) },
      (code) => {
        const now = Date.now();
        if (code === lastRef.current.code && now - lastRef.current.at < 1500) return;
        lastRef.current = { code, at: now };
        const label = onScanRef.current(code);
        beep(!!label);
        setFlash(label ? { text: `Added: ${label}`, ok: true } : { text: `No item with code ${code}`, ok: false });
        setTimeout(() => setFlash(null), 1200);
      },
      () => {},
    ).catch((e) => { if (!stopped) setError(String(e?.message || e || "Camera unavailable")); });
    return () => {
      stopped = true;
      const sc = scannerRef.current;
      scannerRef.current = null;
      if (sc?.isScanning) sc.stop().then(() => sc.clear()).catch(() => {});
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2 font-semibold"><ScanLine className="h-5 w-5 text-primary" /> Scan items</div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close scanner"><X className="h-5 w-5" /></Button>
      </div>
      <div className="relative flex-1 bg-muted flex items-center justify-center overflow-hidden">
        <div id="pos-scanner-region" className="w-full max-w-2xl" />
        {flash && (
          <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full px-5 py-2 text-sm font-medium shadow-lg ${flash.ok ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
            {flash.text}
          </div>
        )}
        {error && <p className="absolute text-center px-6 text-destructive">Camera couldn't start: {error}. Allow camera access and try again.</p>}
      </div>
      <div className="p-4 border-t">
        <Button className="w-full" onClick={onClose}>Done scanning</Button>
      </div>
    </div>
  );
}
