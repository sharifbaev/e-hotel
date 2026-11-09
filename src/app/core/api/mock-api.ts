import { InjectionToken } from '@angular/core';
import { Observable, delay, of, throwError, timer, switchMap } from 'rxjs';
import { localToday } from './api';

/**
 * «Сегодня» для приложения — дата на компьютере (отель и сервер в одном часовом поясе, Asia/Tashkent).
 * В тестах можно подменить провайдером.
 */
export const APP_TODAY = new InjectionToken<string>('APP_TODAY', {
  providedIn: 'root',
  factory: () => localToday(),
});

/** Имитация задержки сети (мс). Видно skeleton-состояния. */
export const MOCK_LATENCY = new InjectionToken<number>('MOCK_LATENCY', {
  providedIn: 'root',
  factory: () => 900,
});

/** Ответ «сервера»: глубокая копия данных с задержкой. */
export function mockResponse<T>(data: T, ms: number): Observable<T> {
  return of(structuredClone(data)).pipe(delay(ms));
}

/**
 * Ошибка сервера с кодом, который UI переводит через i18n (`errors.<code>`).
 * fields — ошибки по полям из ответа 422 validation.failed; status — HTTP-статус (0 — сеть/мок).
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly params: Record<string, string> = {},
    readonly fields: Record<string, string> = {},
    readonly status = 0,
  ) {
    super(code);
  }
}

export function mockError(
  code: string,
  ms: number,
  params: Record<string, string> = {},
): Observable<never> {
  return timer(ms).pipe(switchMap(() => throwError(() => new ApiError(code, params))));
}
