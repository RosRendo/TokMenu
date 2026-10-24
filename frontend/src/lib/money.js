export function formatMoney(minor, currency = "USD") {
  const value = Math.abs(Math.round(Number(minor) || 0));
  const sign = Number(minor) < 0 ? "-" : "";
  if (currency === "KHR") return `${sign}${value.toLocaleString("en-US")}៛`;
  return `${sign}$${(value / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function toMinor(input, currency) {
  const n = Number(String(input ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return NaN;
  return currency === "KHR" ? Math.round(n) : Math.round(n * 100);
}

export function fromMinor(minor, currency) {
  if (minor === null || minor === undefined || minor === "") return "";
  return currency === "KHR" ? String(minor) : (Number(minor) / 100).toFixed(2);
}

export const moneyPattern = (currency) => (currency === "KHR" ? /^\d{1,9}$/ : /^\d{1,6}(\.\d{1,2})?$/);

export const bpsToPercent = (bps) => (Number(bps || 0) / 100).toString();
export const percentToBps = (pct) => Math.round(Number(pct || 0) * 100);
