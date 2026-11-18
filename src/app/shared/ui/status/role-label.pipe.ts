import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { RolesService } from '../../../core/data/roles.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { RoleCode } from '../../../core/models';
import { SYSTEM_ROLES } from './status-styles';

/** Названия начальных ролей по умолчанию (сервер / переводы) — для них показываем перевод. */
const DEFAULT_ROLE_NAMES: Record<string, string[]> = {
  admin: ['admin', 'administrator', 'администратор'],
  accountant: ['accountant', 'buxgalter', 'бухгалтер'],
};

/**
 * Подпись роли: у owner — перевод roles.owner; у admin / accountant — перевод,
 * пока владелец их не переименовал (v1.6), иначе — новое название;
 * у созданных в настройках — их название (из /roles или переданное вторым аргументом).
 */
export function roleLabel(
  code: RoleCode | null | undefined,
  name: string | null | undefined,
  roles: RolesService,
  t: (key: string) => string,
): string {
  if (!code) {
    return '';
  }
  if (!SYSTEM_ROLES.includes(code)) {
    return roles.byCode().get(code)?.name || name || code;
  }
  const custom = code === 'owner' ? '' : (roles.byCode().get(code)?.name || name || '').trim();
  return custom && !DEFAULT_ROLE_NAMES[code]?.includes(custom.toLowerCase())
    ? custom
    : t('roles.' + code);
}

@Pipe({ name: 'roleLabel', pure: false })
export class RoleLabelPipe implements PipeTransform {
  private readonly roles = inject(RolesService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService);

  transform(code: RoleCode | null | undefined, name?: string | null): string {
    this.lang.current();
    return roleLabel(code, name, this.roles, (k) => this.transloco.translate(k));
  }
}
