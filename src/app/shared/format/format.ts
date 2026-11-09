/** Чистые функции форматирования (сумма, даты). Без зависимостей от Angular. */

const NBSP = ' ';

/** 1234567 → «1 234 567». */
export function formatSum(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Для поля ввода суммы: оставляет цифры и группирует разряды обычным пробелом. */
export function formatSumInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function parseSum(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') {
    return raw;
  }
  return Number(String(raw ?? '').replace(/\D/g, '')) || 0;
}

/** «2026-10-26» → «26.10.2026». */
export function formatDmy(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

/** «2026-10-26T14:05» → «14:05». */
export function formatTime(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : '';
}

/** «2026-10-26T14:05:09» → «26.10.2026 14:05:09» (без секунд в данных — «:00»). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  if (iso.length < 16) {
    return formatDmy(iso);
  }
  const time = iso.slice(11, 19);
  return `${formatDmy(iso)} ${time.length === 5 ? `${time}:00` : time}`;
}

/** Месяц (1–12) и день из ISO-даты. */
export function dayAndMonth(iso: string): { day: number; month: number; year: number } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { day: d, month: m, year: y };
}

/** Сдвиг ISO-даты на n дней (UTC, без влияния часового пояса). */
export function addDays(iso: string, n: number): string {
  const date = isoToUtc(iso);
  date.setUTCDate(date.getUTCDate() + n);
  return utcToIso(date);
}

/** Разница в днях между двумя ISO-датами. */
export function diffDays(from: string, to: string): number {
  return Math.round((isoToUtc(to).getTime() - isoToUtc(from).getTime()) / 86_400_000);
}

/** День недели: 0 — понедельник … 6 — воскресенье. */
export function weekdayIndex(iso: string): number {
  return (isoToUtc(iso).getUTCDay() + 6) % 7;
}

export function isoToUtc(iso: string): Date {
  const { day, month, year } = dayAndMonth(iso);
  return new Date(Date.UTC(year, month - 1, day));
}

export function utcToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Date (локальная, из календаря) → «YYYY-MM-DD». */
export function localDateToIso(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** «YYYY-MM-DD» → Date (локальная полночь) для календаря PrimeNG. */
export function isoToLocalDate(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }
  const { day, month, year } = dayAndMonth(iso);
  const time = iso.length >= 16 ? iso.slice(11, 19).split(':').map(Number) : [0, 0];
  return new Date(year, month - 1, day, time[0], time[1], time[2] || 0);
}

/** Date → «YYYY-MM-DDTHH:mm». */
export function localDateTimeToIso(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${localDateToIso(date)}T${hh}:${mm}`;
}

/** Date → «YYYY-MM-DDTHH:mm:ss» (дата и время с секундами). */
export function localDateTimeSecToIso(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${localDateTimeToIso(date)}:${ss}`;
}

/** Инициалы: «Дилноза Каримова» → «ДК». */
export function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, max)
    .toUpperCase();
}

/**
 * Ввод серии и номера документа: заглавные буквы, пробел после двух букв серии,
 * если дальше идут цифры («ab1234567» → «AB 1234567»). Иностранные форматы (PAF902114, C01X00T47) не меняются.
 */
export function formatDocInput(raw: string): string {
  return raw.toUpperCase().replace(/^([A-ZА-ЯЁЎҚҒҲ]{2})(\d)/, '$1 $2');
}
