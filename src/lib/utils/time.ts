/**
 * Time formatting helpers for dual-time display: "HH:mm UTC · HH:mm IST"
 */

export function formatDualTime(dateInput: Date | string | number): string {
  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  // UTC formatting
  const utcHours = String(date.getUTCHours()).padStart(2, "0");
  const utcMinutes = String(date.getUTCMinutes()).padStart(2, "0");
  const utcStr = `${utcHours}:${utcMinutes} UTC`;

  // IST formatting (UTC + 5 hours 30 mins)
  const istDate = new Date(date.getTime() + 5.5 * 3600 * 1000);
  const istHours = String(istDate.getUTCHours()).padStart(2, "0");
  const istMinutes = String(istDate.getUTCMinutes()).padStart(2, "0");
  const istStr = `${istHours}:${istMinutes} IST`;

  return `${utcStr} · ${istStr}`;
}

export function formatDualDateTime(dateInput: Date | string | number): string {
  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  return `${dateStr} (${formatDualTime(date)})`;
}
