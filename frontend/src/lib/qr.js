import QRCode from "qrcode";

export async function qrDataUrl(text, size = 512) {
  return QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: "M", color: { dark: "#1C1C1C", light: "#FFFFFF" } });
}

export function tableMenuUrl(origin, slug, token) {
  return token ? `${origin}/menu/${slug}?t=${encodeURIComponent(token)}` : `${origin}/menu/${slug}`;
}

export function tableLandingUrl(origin, slug, token) {
  return token ? `${origin}/r/${slug}?t=${encodeURIComponent(token)}` : `${origin}/r/${slug}`;
}

export function tableTargetUrl(origin, slug, token, target = "landing") {
  return target === "menu" ? tableMenuUrl(origin, slug, token) : tableLandingUrl(origin, slug, token);
}

export async function downloadQr(text, filename) {
  const url = await qrDataUrl(text, 1024);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
