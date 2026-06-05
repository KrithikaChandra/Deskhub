/**
 * Date display helpers using Intl (locale-aware, good defaults for en-IN etc.).
 */

/** @param {unknown} value */
function toDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Calendar date only — e.g. "7 May 2026" (day + full month + year, no raw ISO).
 * Defaults to en-GB so the day leads; override with `locale` if needed.
 * @param {unknown} value ISO string, timestamp, or Date
 * @param {string} [locale] BCP 47 tag; default "en-GB"
 * @param {string} [timeZone] IANA zone, e.g. "Asia/Kolkata"
 * @returns {string}
 */
export function formatDate(value, locale = "en-GB", timeZone) {
  const date = toDate(value);
  if (!date) return "—";
  const loc = locale ?? "en-GB";
  return new Intl.DateTimeFormat(loc, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(date);
}

/**
 * Date and time of day.
 * @param {unknown} value
 * @param {string} [locale]
 * @param {string} [timeZone]
 * @returns {string}
 */
export function formatDateTime(value, locale, timeZone) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

/**
 * Human-friendly distance from now (e.g. "2 days ago", "in 3 hours").
 * @param {unknown} value
 * @param {string} [locale]
 * @returns {string}
 */
export function formatRelative(value, locale) {
  const date = toDate(value);
  if (!date) return "—";

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, "second");

  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");

  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");

  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, "day");

  const diffWeek = Math.round(diffDay / 7);
  if (Math.abs(diffWeek) < 4) return rtf.format(diffWeek, "week");

  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, "month");

  const diffYear = Math.round(diffDay / 365);
  return rtf.format(diffYear, "year");
}
