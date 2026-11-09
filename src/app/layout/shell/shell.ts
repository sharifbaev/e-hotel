import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Popover } from 'primeng/popover';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { CommentsService } from '../../core/data/comments.service';
import { StaffService } from '../../core/data/staff.service';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { initials } from '../../shared/format/format';
import { ChangePasswordDialog } from '../../shared/ui/change-password/change-password-dialog';
import { Icon } from '../../shared/ui/icon/icon';
import { LangSwitch } from '../../shared/ui/lang-switch/lang-switch';
import { ADMIN_NAV, MAIN_NAV, MOBILE_NAV } from '../nav-items';

const SIDEBAR_KEY = 'hotelos.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

/** Каркас приложения: сайдбар + верхняя панель (десктоп) или нижнее меню (телефон). */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    Popover,
    Tooltip,
    Icon,
    LangSwitch,
    ChangePasswordDialog,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly bp = inject(BreakpointService);
  /** Счётчик новых комментариев в меню обновляется сам. */
  protected readonly comments = inject(CommentsService);

  protected readonly mainNav = MAIN_NAV;
  protected readonly mobileNav = MOBILE_NAV;
  protected readonly adminNav = computed(() => (this.auth.isAdmin() ? ADMIN_NAV : []));
  protected readonly userInitials = computed(() => initials(this.auth.user()?.name ?? ''));

  /** Сайдбар свёрнут: только логотип и иконки (запоминается в браузере). */
  protected readonly collapsed = signal(readCollapsed());

  protected toggleSidebar(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
    } catch {
      // хранилище недоступно (приватный режим) — состояние живёт до перезагрузки
    }
  }

  constructor() {
    this.comments.watch(inject(DestroyRef));
    // Список сотрудников: ФИО для чеков и «Кто оформил».
    inject(StaffService).load();
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
