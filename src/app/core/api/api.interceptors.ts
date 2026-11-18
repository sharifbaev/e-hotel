import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_URL, SKIP_AUTH_RETRY, isApiUrl, toApiError } from './api';

/** Эти вызовы работают без access-токена и не обновляют его при 401. */
const NO_TOKEN_PATHS = ['/auth/login', '/auth/refresh'];

function withToken<T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/**
 * Access-токен в заголовке Authorization. На 401 — один раз обновляет токены
 * (POST /auth/refresh, параллельные запросы ждут одно обновление) и повторяет запрос;
 * не вышло — сессия закрывается и открывается страница входа.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_URL);
  if (!isApiUrl(req.url, base)) {
    return next(req);
  }
  const path = req.url.slice(base.length);
  if (NO_TOKEN_PATHS.some((p) => path.startsWith(p))) {
    return next(req);
  }
  const auth = inject(AuthService);
  return next(withToken(req, auth.accessToken())).pipe(
    catchError((e: unknown) => {
      if (
        !(e instanceof HttpErrorResponse) ||
        e.status !== 401 ||
        req.context.get(SKIP_AUTH_RETRY)
      ) {
        return throwError(() => e);
      }
      if (!auth.canRefresh()) {
        auth.expire();
        return throwError(() => e);
      }
      return auth.refresh().pipe(
        catchError(() => {
          auth.expire();
          return throwError(() => e);
        }),
        switchMap((token) => next(withToken(req, token))),
        catchError((retry: unknown) => {
          if (retry instanceof HttpErrorResponse && retry.status === 401) {
            auth.expire();
          }
          return throwError(() => retry);
        }),
      );
    }),
  );
};

/** Заголовок текущего отеля (v1.6). */
export const HOTEL_HEADER = 'X-Hotel-Id';

/**
 * v1.6: к каждому запросу в /api/v1 добавляет `X-Hotel-Id` текущего отеля (AuthService.hotelId).
 * Не трогает /auth/login и /auth/refresh и запросы, где заголовок уже задан
 * (страница гостя по QR передаёт id отеля из адреса сама).
 * Ответы: 422 hotel.required — открыть выбор отеля; 403 hotel.forbidden — сбросить выбор,
 * перечитать /auth/me и снова предложить выбрать отель.
 */
export const hotelInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_URL);
  if (!isApiUrl(req.url, base)) {
    return next(req);
  }
  const path = req.url.slice(base.length);
  if (NO_TOKEN_PATHS.some((p) => path.startsWith(p))) {
    return next(req);
  }
  const auth = inject(AuthService);
  const hotelId = auth.hotelId();
  const out =
    hotelId !== null && !req.headers.has(HOTEL_HEADER)
      ? req.clone({ setHeaders: { [HOTEL_HEADER]: String(hotelId) } })
      : req;
  return next(out).pipe(
    catchError((e: unknown) => {
      if (e instanceof HttpErrorResponse && (e.status === 422 || e.status === 403)) {
        const code = toApiError(e).code;
        if (code === 'hotel.required') {
          auth.requireHotel();
        } else if (code === 'hotel.forbidden' && !path.startsWith('/auth/me')) {
          auth.hotelForbidden();
        }
      }
      return throwError(() => e);
    }),
  );
};

/** Ошибки API → ApiError с кодом сервера (`auth.invalid`, `rooms.full`…) для i18n. */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiUrl(req.url, inject(API_URL))) {
    return next(req);
  }
  return next(req).pipe(catchError((e: unknown) => throwError(() => toApiError(e))));
};
