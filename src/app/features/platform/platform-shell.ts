import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { ChangePasswordDialog } from '../../shared/ui/change-password/change-password-dialog';
import { Icon, IconName } from '../../shared/ui/icon/icon';
import { LangSwitch } from '../../shared/ui/lang-switch/lang-switch';

interface PlatformLink {
  path: string;
  label: string;
  icon: IconName;
}

/** Меню платформы (v1.6). */
const PLATFORM_NAV: PlatformLink[] = [
  { path: '/platform/organizations', label: 'platform.nav.organizations', icon: 'building' },
  { path: '/platform/admins', label: 'platform.nav.admins', icon: 'shield' },
];

/**
 * Каркас панели супер-админа (v1.7: открывается по user.platformAdmin, адрес общий): верхняя панель с меню платформы.
 * Вход в отель — со страницы владельца («Войти в отель»).
 */
@Component({
  selector: 'app-platform-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    Tooltip,
    Icon,
    LangSwitch,
    ChangePasswordDialog,
  ],
  template: `
    <a class="skip-link" href="#main">{{ 'common.skipToContent' | transloco }}</a>
    <div class="flex min-h-dvh flex-col bg-app">
      <header
        class="sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-white px-6 py-2.5 max-md:px-4"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-ink text-base font-bold text-white"
            aria-hidden="true"
          >
            H
          </div>
          <div class="flex flex-col">
            <span class="text-base leading-tight font-bold">HotelOS</span>
            <span class="text-xs text-muted">{{ 'platform.title' | transloco }}</span>
          </div>
        </div>
        <nav
          [attr.aria-label]="'nav.main' | transloco"
          class="flex gap-1 max-md:order-last max-md:w-full"
        >
          @for (l of nav; track l.path) {
            <a
              class="plat-link"
              [routerLink]="l.path"
              routerLinkActive="plat-active"
              ariaCurrentWhenActive="page"
            >
              <app-icon [name]="l.icon" [size]="18" [stroke]="1.8" />
              {{ l.label | transloco }}
            </a>
          }
        </nav>
        <div class="ml-auto flex items-center gap-2">
          <app-lang-switch />
          <button
            type="button"
            class="plat-btn"
            [attr.aria-label]="'password.menu' | transloco"
            [pTooltip]="'password.menu' | transloco"
            tooltipPosition="bottom"
            (click)="auth.passwordDialog.set(true)"
          >
            <app-icon name="key" [size]="20" [stroke]="1.8" />
          </button>
          <span class="max-w-48 truncate text-sm font-semibold max-md:hidden">{{
            auth.user()?.name
          }}</span>
          <button
            type="button"
            class="plat-btn"
            [attr.aria-label]="'shell.logout' | transloco"
            [pTooltip]="'shell.logout' | transloco"
            tooltipPosition="bottom"
            (click)="logout()"
          >
            <app-icon name="logout" [size]="20" [stroke]="1.8" />
          </button>
        </div>
      </header>
      <main id="main" tabindex="-1" class="flex min-w-0 flex-1 flex-col outline-none">
        <router-outlet />
      </main>
    </div>
    <app-change-password-dialog />
  `,
  styles: `
    .skip-link {
      position: absolute;
      left: 12px;
      top: -48px;
      z-index: 100;
      padding: 10px 14px;
      border-radius: 8px;
      background: var(--color-accent);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      transition: top 0.15s;
    }
    .skip-link:focus {
      top: 12px;
    }
    .plat-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 38px;
      padding: 0 12px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: var(--color-ink-2);
      text-decoration: none;
      transition: background-color 0.15s;
    }
    .plat-link:hover {
      background: #f2f4f7;
      color: var(--color-ink);
    }
    .plat-active {
      background: #f2f4f7;
      color: var(--color-ink);
      font-weight: 600;
    }
    .plat-btn {
      width: 40px;
      height: 40px;
      border: 1px solid var(--color-line);
      border-radius: 8px;
      background: #fff;
      color: var(--color-ink-2);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .plat-btn:hover {
      background: #f9fafb;
    }
  `,
})
export class PlatformShell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly nav = PLATFORM_NAV;

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
