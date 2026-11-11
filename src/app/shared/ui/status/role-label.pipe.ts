import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { RolesService } from '../../../core/data/roles.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { RoleCode } from '../../../core/models';
import { SYSTEM_ROLES } from './status-styles';

/**
 * Подпись роли: у системных ролей (owner / admin / accountant) — перевод roles.<code>,
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
  if (SYSTEM_ROLES.includes(code)) {
    return t('roles.' + code);
  }
  return roles.byCode().get(code)?.name || name || code;
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
