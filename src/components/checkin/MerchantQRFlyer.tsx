// Print-ready merchant QR flyer template.
// Wired from the developer handoff design (3.5"x5" / 5"x7" card).
// Renders as a popup window so the merchant can Print/Save-as-PDF.

const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

export interface MerchantQRFlyerOptions {
  merchantName: string;
  qrImageDataUrl: string; // PNG/SVG data URL of the QR code
  badgeLabel?: string; // e.g. "PawBucks Partner" | "Check-In"
  headline?: string; // e.g. "Scan to\nCheck In"
  subline?: string; // small line under headline
  instruction?: string; // helper instruction line
  earnLeft?: string | null; // left side of teal earn strip
  earnRight?: string | null; // right side big number (e.g. "20x")
  brandFrom?: string; // header gradient start
  brandTo?: string; // header gradient end
}

export const generateMerchantQRFlyerHTML = (opts: MerchantQRFlyerOptions): string => {
  const merchantName = escapeHtml(opts.merchantName);
  const badgeLabel = escapeHtml(opts.badgeLabel ?? "PawBucks Partner");
  const headline = escapeHtml(opts.headline ?? "Scan to\nCheck In");
  const subline = escapeHtml(opts.subline ?? "Open your camera. Tap the link.");
  const instruction = escapeHtml(
    opts.instruction ??
      "Point your phone camera at the code. Tap the link. You'll automatically check in and unlock today's offer."
  );
  const earnLeft = opts.earnLeft ? escapeHtml(opts.earnLeft) : null;
  const earnRight = opts.earnRight ? escapeHtml(opts.earnRight) : null;
  const brandFrom = opts.brandFrom ?? "#0a4a52";
  const brandTo = opts.brandTo ?? "#062228";
  const qrSrc = opts.qrImageDataUrl;

  const initials = merchantName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "PB";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PawBucks QR — ${merchantName}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: #e8edf2;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 24px;
  }
  .card {
    width: 380px; border-radius: 24px; overflow: hidden;
    box-shadow: 0 4px 6px rgba(0,0,0,0.07), 0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.08);
    background: #ffffff; position: relative;
  }
  .header {
    background: linear-gradient(160deg, ${brandFrom} 0%, ${brandTo} 100%);
    padding: 28px 28px 22px; text-align: center; position: relative; overflow: hidden;
  }
  .header::before {
    content: ''; position: absolute; top: -60px; left: 50%;
    transform: translateX(-50%); width: 300px; height: 240px;
    background: radial-gradient(ellipse, rgba(18,168,179,0.18) 0%, transparent 70%);
    pointer-events: none;
  }
  .header::after {
    content: ''; position: absolute; inset: 0;
    background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
    background-size: 18px 18px; pointer-events: none;
  }
  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: #12a8b3; color: #fff;
    font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    padding: 5px 14px; border-radius: 999px; margin-bottom: 14px;
    position: relative; z-index: 1; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .headline {
    font-size: 32px; font-weight: 900; color: #fff;
    line-height: 1.1; letter-spacing: -0.03em; white-space: pre-line;
    position: relative; z-index: 1; margin-bottom: 6px;
  }
  .subline { font-size: 13px; color: rgba(255,255,255,0.7); font-weight: 500; position: relative; z-index: 1; }
  .qr-section { background: #fff; padding: 26px 28px 20px; text-align: center; }
  .qr-frame {
    display: inline-block; padding: 14px; background: #fff; border-radius: 16px;
    box-shadow: 0 0 0 1.5px #e8edf2, 0 4px 20px rgba(10,31,38,0.08);
    position: relative; margin-bottom: 18px;
  }
  .qr-frame::before, .qr-frame::after {
    content: ''; position: absolute; width: 22px; height: 22px;
    border-color: #12a8b3; border-style: solid;
  }
  .qr-frame::before { top: -1px; left: -1px; border-width: 3px 0 0 3px; border-radius: 6px 0 0 0; }
  .qr-frame::after { bottom: -1px; right: -1px; border-width: 0 3px 3px 0; border-radius: 0 0 6px 0; }
  .qr-img { width: 220px; height: 220px; display: block; image-rendering: pixelated; }
  .instruction-wrap {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 10px 16px; background: #f8f9fa; border: 1px solid #e8edf2; border-radius: 10px; margin: 0 28px;
  }
  .instruction-icon {
    width: 28px; height: 28px; border-radius: 8px; background: #12a8b3; color: #fff;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    font-size: 14px; font-weight: 800;
  }
  .instruction-text { font-size: 11px; color: #475569; font-weight: 500; line-height: 1.5; text-align: left; }
  .merchant-strip { padding: 16px 28px 0; display: flex; align-items: center; gap: 10px; }
  .merchant-avatar {
    width: 36px; height: 36px; border-radius: 9px;
    background: linear-gradient(135deg, ${brandFrom}, ${brandTo});
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 12px; font-weight: 800; flex-shrink: 0;
  }
  .merchant-name { font-size: 14px; font-weight: 700; color: #0f172a; }
  .merchant-sub { font-size: 11px; color: #94a3b8; margin-top: 1px; }
  .earn-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 28px; margin: 14px 0 0;
    background: #e8f9fa; border-top: 1px solid #99f0ea; border-bottom: 1px solid #99f0ea;
  }
  .earn-left { font-size: 12px; color: #0a8f9a; font-weight: 600; line-height: 1.4; }
  .earn-right { font-size: 22px; font-weight: 900; color: #12a8b3; letter-spacing: -0.02em; }
  .footer { padding: 14px 28px 22px; display: flex; align-items: center; justify-content: space-between; }
  .footer-powered { font-size: 10px; color: #94a3b8; font-weight: 500; letter-spacing: 0.04em; }
  .footer-powered span { color: #12a8b3; font-weight: 700; }
  .footer-url { font-size: 10px; color: #cbd5e1; font-weight: 600; }
  @media print {
    body { background: white; padding: 0; margin: 0; }
    .card { box-shadow: none; border-radius: 0; width: 100%; max-width: 100%; }
    .card * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">${badgeLabel}</div>
      <div class="headline">${headline}</div>
      <div class="subline">${subline}</div>
    </div>
    <div class="qr-section">
      <div class="qr-frame">
        <img class="qr-img" src="${qrSrc}" alt="Scan to check in at ${merchantName}" />
      </div>
      <div class="instruction-wrap">
        <div class="instruction-icon">i</div>
        <div class="instruction-text">${instruction}</div>
      </div>
    </div>
    <div class="merchant-strip">
      <div class="merchant-avatar">${escapeHtml(initials)}</div>
      <div>
        <div class="merchant-name">${merchantName}</div>
        <div class="merchant-sub">${badgeLabel}</div>
      </div>
    </div>
    ${earnRight ? `
    <div class="earn-row">
      <div class="earn-left">${earnLeft ?? "Earn PawBucks every visit"}</div>
      <div class="earn-right">${earnRight}</div>
    </div>` : ""}
    <div class="footer">
      <div class="footer-powered">Powered by <span>PawBucks</span></div>
      <div class="footer-url">pawbucks.app</div>
    </div>
  </div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 350));</script>
</body>
</html>`;
};

export const printMerchantQRFlyer = (opts: MerchantQRFlyerOptions) => {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(generateMerchantQRFlyerHTML(opts));
  w.document.close();
  return true;
};