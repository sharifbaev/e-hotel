import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Логин с префиксом владельца (API v1.7): `<код владельца>_<имя>`, например grand_aziz;
 * супер-админы — `platform_<имя>`. В формах префикс — неизменяемая часть поля,
 * пользователь вводит только имя; при отправке префикс добавляет фронт.
 */

/** Полный логин: 3–64 символа (как на сервере). */
export const FULL_LOGIN_RE = /^[a-z0-9._-]{3,64}$/;
/** Часть после префикса. */
const LOGIN_NAME_RE = /^[a-z0-9._-]+$/;

/** Префикс супер-админов платформы. */
export const PLATFORM_LOGIN_PREFIX = 'platform_';

/** Префикс сотрудников владельца: grand → grand_. */
export function orgLoginPrefix(code: string | null | undefined): string {
  return `${(code ?? '').trim()}_`;
}

/** Префикс уже существующего логина: всё до первого «_» включительно (в коде «_» нет). */
export function loginPrefixOf(login: string): string | null {
  const i = login.indexOf('_');
  return i > 0 ? login.slice(0, i + 1) : null;
}

/** grand_ + aziz → grand_aziz. */
export function joinLogin(prefix: string, name: string): string {
  return `${prefix}${name.trim()}`;
}

/** grand_aziz → aziz (если логин начинается с префикса), иначе логин целиком. */
export function loginName(prefix: string, login: string): string {
  return prefix && login.startsWith(prefix) ? login.slice(prefix.length) : login;
}

/**
 * Валидатор поля «имя» (без префикса): хотя бы один символ из [a-z0-9._-],
 * полный логин — 3–64 символа. prefix — функция, т.к. префикс может меняться (код в форме владельца).
 */
export function loginNameValidator(prefix: () => string): ValidatorFn {
  return (c: AbstractControl<string>): ValidationErrors | null => {
    const name = (c.value ?? '').trim();
    if (!name) {
      return null; // пустое — забота Validators.required
    }
    return LOGIN_NAME_RE.test(name) && FULL_LOGIN_RE.test(joinLogin(prefix(), name))
      ? null
      : { login: true };
  };
}
