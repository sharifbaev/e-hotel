import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { dayAndMonth, formatDmy, formatSum, formatTime } from './format';

/** 1234567 → «1 234 567». */
@Pipe({ name: 'sum' })
export class SumPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatSum(value);
  }
}

/** ISO → «26.10.2026». */
@Pipe({ name: 'dmy' })
export class DmyPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatDmy(value);
  }
}

/**
 * ISO → «26 окт» (с временем: «26 окт, 14:00»).
 * Нечистый пайп: пересчитывается при смене языка.
 */
@Pipe({ name: 'dayMonth', pure: false })
export class DayMonthPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(
    value: string | null | undefined,
    opts: { time?: boolean; year?: boolean } = {},
  ): string {
    if (!value) {
      return '';
    }
    const { day, month, year } = dayAndMonth(value);
    let out = `${day} ${this.transloco.translate(`months.short.${month}`)}`;
    if (opts.year) {
      out += ` ${year}`;
    }
    if (opts.time) {
      out += `, ${formatTime(value)}`;
    }
    return out;
  }
}

/**
 * Число + слово в правильной форме: 4 | plural:'night' → «4 ночи».
 * Формы лежат в i18n: plural.<слово>.one / few / many (в узбекском формы одинаковые).
 */
@Pipe({ name: 'plural', pure: false })
export class PluralPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(count: number, word: string, withNumber = true): string {
    const form = this.transloco.translate(`plural.${word}.${pluralForm(count)}`);
    return withNumber ? `${count} ${form}` : form;
  }
}

/** Правило русского языка; для узбекского все три формы в словаре совпадают. */
export function pluralForm(n: number): 'one' | 'few' | 'many' {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return 'one';
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'few';
  }
  return 'many';
}
