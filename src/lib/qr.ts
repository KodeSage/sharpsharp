import QRCode from 'qrcode';

/**
 * Generate a QR code data URL for a given URL.
 */
export async function generateQRDataURL(url: string, opts?: { width?: number; margin?: number }): Promise<string> {
  return QRCode.toDataURL(url, {
    width: opts?.width ?? 400,
    margin: opts?.margin ?? 2,
    color: { dark: '#1A1A1A', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  });
}

export type PosterStyle = 'bold' | 'market' | 'minimal';

/* ---------- Shared print boilerplate ---------- */
function printHtml(html: string): void {
  // No 'noopener' here: with it, window.open returns null and we can't write the poster.
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print your poster.');
    return;
  }
  printWindow.opener = null;
  printWindow.document.write(html);
  printWindow.document.close();
}

/* ---------- 1. Bold Sign ---------- */
function boldSignPoster(opts: PosterOpts): string {
  const { shopName, shopUrl, hours, qrDataUrl, brandColor } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${shopName} — Bold Sign Poster</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    width: 210mm; height: 297mm;
    background: ${brandColor};
    color: white;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .poster { text-align: center; padding: 20mm; width: 100%; }
  .shop-name {
    font-size: 64px; font-weight: 900; letter-spacing: -0.03em;
    line-height: 1.0; margin-bottom: 8mm;
  }
  .scan-text {
    font-size: 28px; font-weight: 700; margin-bottom: 10mm;
    opacity: 0.95;
  }
  .qr-card {
    background: white; border-radius: 24px; padding: 20px;
    width: 300px; margin: 0 auto 10mm;
  }
  .qr-card img { width: 100%; height: auto; display: block; border-radius: 8px; }
  .url { font-size: 13px; opacity: 0.8; word-break: break-all; margin-bottom: 6mm; font-family: monospace; }
  .hours { font-size: 18px; margin-bottom: 20mm; opacity: 0.9; }
  .footer { font-size: 12px; opacity: 0.6; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="poster">
    <h1 class="shop-name">${shopName}</h1>
    <p class="scan-text">SCAN TO ORDER</p>
    <div class="qr-card"><img src="${qrDataUrl}" alt="QR code" /></div>
    <p class="scan-text" style="font-size:20px;margin-bottom:8mm">Scan to order on WhatsApp 📲</p>
    <p class="url">${shopUrl}</p>
    <p class="hours">${hours}</p>
    <p class="footer">Made in 60s with SharpSharp</p>
  </div>
  <script>window.onload=function(){window.print()}</script>
</body>
</html>`;
}

/* ---------- 2. Market Stall ---------- */
function marketStallPoster(opts: PosterOpts): string {
  const { shopName, shopUrl, hours, qrDataUrl, brandColor, cheapestPrice } = opts;
  const priceLabel = cheapestPrice ? `From ₦${cheapestPrice.toLocaleString('en-NG')}` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${shopName} — Market Stall Poster</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    width: 210mm; height: 297mm;
    background: #FAF6EF;
    color: #1A1A1A;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .border-frame {
    position: relative; width: 180mm; height: 260mm;
    border: 2px solid ${brandColor};
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 16mm;
  }
  /* Geometric triangle corners */
  .corner {
    position: absolute; width: 28mm; height: 28mm;
    border: 2px solid ${brandColor};
  }
  .corner.tl { top: -2px; left: -2px; border-right: none; border-bottom: none; }
  .corner.tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
  .corner.bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }
  .corner.br { bottom: -2px; right: -2px; border-left: none; border-top: none; }
  /* Diamond accents on sides */
  .diamond {
    position: absolute; width: 10mm; height: 10mm;
    background: ${brandColor}; transform: rotate(45deg);
  }
  .diamond.left { left: -5mm; top: 50%; margin-top: -5mm; }
  .diamond.right { right: -5mm; top: 50%; margin-top: -5mm; }
  .poster { text-align: center; }
  .shop-name {
    font-size: 42px; font-weight: 800; letter-spacing: -0.02em;
    line-height: 1.1; margin-bottom: 6mm; color: #1A1A1A;
  }
  .sticker {
    display: inline-block; background: ${brandColor}; color: white;
    font-size: 16px; font-weight: 700; padding: 6px 18px;
    border-radius: 6px; transform: rotate(-4deg);
    margin-bottom: 10mm; box-shadow: 2px 3px 0 rgba(0,0,0,0.1);
  }
  .qr { margin: 0 auto 8mm; width: 260px; height: 260px; }
  .qr img { width: 100%; height: 100%; }
  .scan-text { font-size: 20px; font-weight: 600; margin-bottom: 5mm; color: #1A1A1A; }
  .url { font-size: 13px; color: #666; word-break: break-all; margin-bottom: 4mm; font-family: monospace; }
  .hours { font-size: 16px; color: #333; margin-bottom: 12mm; }
  .footer { font-size: 12px; color: #999; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="border-frame">
    <div class="corner tl"></div>
    <div class="corner tr"></div>
    <div class="corner bl"></div>
    <div class="corner br"></div>
    <div class="diamond left"></div>
    <div class="diamond right"></div>
    <div class="poster">
      <h1 class="shop-name">${shopName}</h1>
      ${priceLabel ? `<div class="sticker">${priceLabel}</div>` : ''}
      <div class="qr"><img src="${qrDataUrl}" alt="QR code" /></div>
      <p class="scan-text">Scan to order on WhatsApp 📲</p>
      <p class="url">${shopUrl}</p>
      <p class="hours">${hours}</p>
      <p class="footer">Made in 60s with SharpSharp</p>
    </div>
  </div>
  <script>window.onload=function(){window.print()}</script>
</body>
</html>`;
}

/* ---------- 3. Minimal ---------- */
function minimalPoster(opts: PosterOpts): string {
  const { shopName, shopUrl, hours, qrDataUrl } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${shopName} — Minimal Poster</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    width: 210mm; height: 297mm;
    background: white; color: #000;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .poster { text-align: center; padding: 20mm; }
  .shop-name {
    font-size: 36px; font-weight: 800; letter-spacing: -0.02em;
    line-height: 1.1; margin-bottom: 12mm;
  }
  .qr { margin: 0 auto 12mm; width: 380px; height: 380px; }
  .qr img { width: 100%; height: 100%; }
  .scan-text { font-size: 22px; font-weight: 600; margin-bottom: 8mm; }
  .url { font-size: 15px; color: #333; word-break: break-all; margin-bottom: 6mm; font-family: monospace; }
  .hours { font-size: 18px; color: #333; margin-bottom: 20mm; }
  .divider { width: 60mm; height: 1px; background: #ddd; margin: 0 auto 8mm; }
  .footer { font-size: 12px; color: #999; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="poster">
    <h1 class="shop-name">${shopName}</h1>
    <div class="qr"><img src="${qrDataUrl}" alt="QR code" /></div>
    <p class="scan-text">Scan to order on WhatsApp 📲</p>
    <p class="url">${shopUrl}</p>
    <p class="hours">${hours}</p>
    <div class="divider"></div>
    <p class="footer">Made in 60s with SharpSharp</p>
  </div>
  <script>window.onload=function(){window.print()}</script>
</body>
</html>`;
}

/* ---------- Public API ---------- */
export type PosterOpts = {
  shopName: string;
  shopUrl: string;
  hours: string;
  qrDataUrl: string;
  brandColor: string;
  cheapestPrice?: number;
};

export function printPoster(opts: PosterOpts, style: PosterStyle = 'bold'): void {
  let html: string;
  switch (style) {
    case 'market':
      html = marketStallPoster(opts);
      break;
    case 'minimal':
      html = minimalPoster(opts);
      break;
    case 'bold':
    default:
      html = boldSignPoster(opts);
      break;
  }
  printHtml(html);
}
