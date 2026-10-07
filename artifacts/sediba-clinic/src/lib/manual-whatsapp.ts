export type MessageKind = "confirmation" | "reminder" | "review";
export function whatsappNumber(raw: string): string | null {
  const clean = raw.trim().replace(/[\s()-]/g, "");
  let number = clean.replace(/^\+/, "").replace(/^00/, "");
  if (/^0[1-9]\d{8}$/.test(number)) number = `27${number.slice(1)}`;
  if (!/^[1-9]\d{7,14}$/.test(number)) return null;
  if (number.startsWith("27") && !/^27[1-9]\d{8}$/.test(number)) return null;
  return number;
}
export function safeReviewUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function manualMessage(kind: MessageKind, appt: { clientName: string; date: string; time: string; bookingRef: string }, clinic: string, reviewUrl: string) {
  const [year, month, day] = appt.date.split("-");
  const when = `${day}/${month}/${year} at ${appt.time.slice(0,5)} (South Africa time)`;
  const intro = `Hi ${appt.clientName},`;
  if (kind === "review") return `${intro}\nThank you for visiting ${clinic}. If you would like to share your experience, please leave an honest Google review:\n${reviewUrl}\nThank you.`;
  return `${intro}\n${kind === "confirmation" ? "Your appointment is confirmed" : "A reminder about your upcoming appointment"} at ${clinic}.\nDate: ${when}\nReference: ${appt.bookingRef}\nPlease contact the clinic if you need to change your appointment.`;
}
