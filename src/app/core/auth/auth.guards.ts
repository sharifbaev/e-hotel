import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppSection } from '../models';
import { AuthService } from './auth.service';

/** Пускает только вошедших пользователей, иначе — на страницу входа. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() || inject(Router).createUrlTree(['/login']);
};

/** Страница входа доступна только гостям. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.isLoggedIn() || inject(Router).parseUrl(auth.homePath());
};

/**
 * Каркас отеля: супер-админу, который не вошёл в отель, — панель платформы (v1.6).
 */
export const hotelModeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.platformMode() || inject(Router).createUrlTree(['/platform']);
};

/**
 * Панель платформы — только супер-админ. Вход на неё = выход из отеля
 * (X-Hotel-Id больше не отправляется).
 */
export const platformGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.isPlatformAdmin()) {
    return inject(Router).parseUrl(auth.homePath());
  }
  if (auth.hotelId() !== null) {
    auth.selectHotel(null);
  }
  return true;
};

/** Разделы администрирования — только владелец и администратор. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAdmin() || inject(Router).createUrlTree(['/dashboard']);
};

/** «Журнал действий» — только владелец. */
export const ownerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isOwner() || inject(Router).parseUrl(auth.homePath());
};

/** Раздел меню доступен роли пользователя, иначе — на первый доступный раздел. */
export function sectionGuard(section: AppSection): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    return auth.can(section) || inject(Router).parseUrl(auth.homePath());
  };
}
