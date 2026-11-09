import { DOCUMENT } from '@angular/common';
import { Service, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { PrimeNG } from 'primeng/config';
import { Translation } from 'primeng/api';
import { Observable, take, tap } from 'rxjs';
import { Lang } from '../models';

const STORAGE_KEY = 'hotelos.lang';

export const LANGS: { code: Lang; short: string; html: string }[] = [
  { code: 'ru', short: 'RU', html: 'ru' },
  { code: 'uz-Latn', short: 'O‘Z', html: 'uz-Latn' },
  { code: 'uz-Cyrl', short: 'ЎЗ', html: 'uz-Cyrl' },
];

/**
 * Текущий язык интерфейса: переключает Transloco, словарь PrimeNG
 * (календарь, пустые списки) и атрибут lang у <html>.
 */
@Service()
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly primeng = inject(PrimeNG);
  private readonly document = inject(DOCUMENT);

  /**
   * Активный язык. Меняется только после загрузки словаря, поэтому
   * computed() с переводами (колонки таблиц, графики) всегда видят готовый текст.
   */
  readonly current = signal<Lang>(readLang());

  /** Вызывается один раз при старте: дожидаемся словаря, чтобы не мигали ключи. */
  init(): Observable<unknown> {
    this.transloco.selectTranslateObject<Translation>('primeng').subscribe((t) => {
      if (t && typeof t === 'object') {
        this.primeng.setTranslation(t);
      }
    });
    return this.apply(this.current());
  }

  use(lang: Lang): void {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
    this.apply(lang).subscribe();
  }

  private apply(lang: Lang): Observable<unknown> {
    return this.transloco.load(lang).pipe(
      take(1),
      tap(() => {
        this.transloco.setActiveLang(lang);
        this.current.set(lang);
        this.document.documentElement.lang = LANGS.find((l) => l.code === lang)?.html ?? 'ru';
      }),
    );
  }
}

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGS.some((l) => l.code === saved)) {
      return saved as Lang;
    }
  } catch {
    // ignore
  }
  return 'ru';
}
