const TZ = "America/Sao_Paulo";

function toBrasilia(date?: Date): Date {
  const d = date ?? new Date();
  return new Date(d.toLocaleString("en-US", { timeZone: TZ }));
}

export function getBrasiliaHour(date?: Date): number {
  return toBrasilia(date).getHours();
}

export function getBrasiliaDay(date?: Date): number {
  return toBrasilia(date).getDay();
}

export function getBrasiliaMonthIndex(date?: Date): number {
  return toBrasilia(date).getMonth();
}

export function getBrasiliaYear(date?: Date): number {
  return toBrasilia(date).getFullYear();
}

export function getBrasiliaDate(date?: Date): number {
  return toBrasilia(date).getDate();
}

export function formatBrasiliaDateInput(date?: Date): string {
  const b = toBrasilia(date);
  const y = b.getFullYear();
  const m = String(b.getMonth() + 1).padStart(2, "0");
  const d = String(b.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
