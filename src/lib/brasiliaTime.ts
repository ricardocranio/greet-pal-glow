const TZ = "America/Sao_Paulo";

/**
 * Returns a Date object representing the current time in Brasília,
 * but with the local time values (hours, minutes, etc.) shifted to match Brasília's.
 * This is useful for getting hours/minutes/etc. in Brasília regardless of local TZ.
 */
export function getBrasiliaDateObj(date?: Date): Date {
  const d = date ?? new Date();
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(d);
  const v: Record<string, string> = {};
  parts.forEach(p => v[p.type] = p.value);
  
  // Create a date in local time that HAS the numbers of Brasília time
  return new Date(
    parseInt(v.year),
    parseInt(v.month) - 1,
    parseInt(v.day),
    parseInt(v.hour),
    parseInt(v.minute),
    parseInt(v.second)
  );
}

export function getBrasiliaHour(date?: Date): number {
  return getBrasiliaDateObj(date).getHours();
}

export function getBrasiliaDay(date?: Date): number {
  return getBrasiliaDateObj(date).getDay();
}

export function getBrasiliaMonthIndex(date?: Date): number {
  return getBrasiliaDateObj(date).getMonth();
}

export function getBrasiliaYear(date?: Date): number {
  return getBrasiliaDateObj(date).getFullYear();
}

export function getBrasiliaDate(date?: Date): number {
  return getBrasiliaDateObj(date).getDate();
}

export function formatBrasiliaDateInput(date?: Date): string {
  const b = getBrasiliaDateObj(date);
  const y = b.getFullYear();
  const m = String(b.getMonth() + 1).padStart(2, "0");
  const d = String(b.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
