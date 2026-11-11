import { HttpContextToken, HttpErrorResponse } from '@angular/common/http';
import { InjectionToken } from '@angular/core';
import { ApiError } from './mock-api';

/**
 * Базовый адрес REST API (backend HotelOS, Swagger: /swagger-ui/index.html).
 * В dev-режиме `/api/v1` проксируется на сервер (proxy.conf.json), в production
 * фронт должен открываться с того же домена, что и API (или поменять значение здесь).
 */
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => '/api/v1',
});

/** Запрос не должен запускать обновление токена при 401 (logout, служебные вызовы). */
export const SKIP_AUTH_RETRY = new HttpContextToken<boolean>(() => false);

/** Тело ошибки сервера: `{ "error": { "code", "message", "fields"? } }`. */
interface ErrorBody {
  error?: { code?: unknown; fields?: unknown };
}

const STATUS_CODES: Record<number, string> = {
  401: 'auth.unauthorized',
  403: 'auth.forbidden',
  404: 'common.notFound',
};

/** Любая ошибка HTTP → ApiError с кодом для i18n (`errors.<code>`). */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) {
    return e;
  }
  if (!(e instanceof HttpErrorResponse)) {
    return new ApiError('common.unknown');
  }
  if (e.status === 0) {
    return new ApiError('common.network');
  }
  const body = parseBody(e.error)?.error;
  const code =
    typeof body?.code === 'string' && body.code
      ? body.code
      : (STATUS_CODES[e.status] ?? 'common.unknown');
  const fields: Record<string, string> = {};
  if (body?.fields && typeof body.fields === 'object') {
    for (const [k, v] of Object.entries(body.fields)) {
      fields[k] = String(v);
    }
  }
  return new ApiError(code, {}, fields, e.status);
}

function parseBody(raw: unknown): ErrorBody | null {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as ErrorBody;
    } catch {
      return null;
    }
  }
  return raw && typeof raw === 'object' ? (raw as ErrorBody) : null;
}

/** Запрос идёт в наш API (а не в i18n, шаблоны, локальный сервер QR). */
export function isApiUrl(url: string, base: string): boolean {
  return url === base || url.startsWith(base + '/');
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Дата-время с сервера → локальное «YYYY-MM-DDTHH:mm[:ss]», как ждут таблицы и формы:
 * без долей секунды; если сервер прислал зону (Z / +05:00) — переводим в местное время.
 */
export function localDateTime<T extends string | null | undefined>(v: T): T {
  if (!v || v.length <= 10) {
    return v;
  }
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` as T;
    }
  }
  return v.replace(/\.\d+$/, '') as T;
}

/**
 * Поле «только дата» (дата рождения, сроки паспорта, дата въезда) → «YYYY-MM-DD».
 * Если сервер прислал дату со временем — время отбрасываем без перевода часового пояса,
 * чтобы дата не съехала на день.
 */
export function localDate<T extends string | null | undefined>(v: T): T {
  return (v && v.length > 10 ? v.slice(0, 10) : v) as T;
}

/** Поля документа гостя «только дата» — к виду «YYYY-MM-DD». */
export function normDocDates<
  T extends { birthDate?: string | null; issuedAt?: string | null; expiresAt?: string | null; entryDate?: string | null },
>(g: T): T {
  return {
    ...g,
    ...('birthDate' in g ? { birthDate: localDate(g.birthDate) } : {}),
    ...('issuedAt' in g ? { issuedAt: localDate(g.issuedAt) } : {}),
    ...('expiresAt' in g ? { expiresAt: localDate(g.expiresAt) } : {}),
    ...('entryDate' in g ? { entryDate: localDate(g.entryDate) } : {}),
  };
}

/** Сегодняшняя дата по часам компьютера, «YYYY-MM-DD». */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
