import { Component, inject, input, model, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { NotifyService } from '../../../core/notify/notify.service';
import { CopyButton } from '../copy-button/copy-button';
import { Icon } from '../icon/icon';

/** Строка окна: ключ i18n подписи и значение (ссылка, логин, пароль). */
export interface CredentialRow {
  label: string;
  value: string;
  /** Моноширинный крупный шрифт (логин, пароль). */
  mono?: boolean;
}

/**
 * Окно «передать доступ» (v1.6): ссылка / логин / пароль показываются один раз,
 * кнопка «Скопировать всё» копирует их одним текстом.
 */
@Component({
  selector: 'app-credentials-dialog',
  imports: [TranslocoPipe, ButtonModule, Dialog, Icon, CopyButton],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [header]="title() | transloco"
      [style]="{ width: '480px', maxWidth: 'calc(100vw - 32px)' }"
      styleClass="hs-dialog"
      [closeAriaLabel]="'common.close' | transloco"
      (onHide)="copied.set(false)"
    >
      <div class="flex flex-col gap-3">
        @if (text()) {
          <p class="m-0 text-sm text-ink-2">{{ text() | transloco: params() }}</p>
        }
        @for (r of rows(); track r.label) {
          <div
            class="flex items-center gap-3 rounded-[10px] border border-line bg-[#F9FAFB] px-4 py-3"
          >
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <span class="text-xs text-muted">{{ r.label | transloco }}</span>
              <span
                class="break-all text-ink select-all"
                [class.font-mono]="r.mono"
                [class.text-lg]="r.mono"
                [class.font-semibold]="r.mono"
                [class.text-sm]="!r.mono"
                >{{ r.value }}</span
              >
            </div>
            <!-- Скопировать одно значение (логин, пароль, адрес) -->
            <app-copy-button [value]="r.value" />
          </div>
        }
        <p class="m-0 text-xs text-muted">{{ 'platform.credentials.hint' | transloco }}</p>
      </div>
      <ng-template #footer>
        <button pButton type="button" severity="secondary" [outlined]="true" (click)="copy()">
          <app-icon [name]="copied() ? 'check' : 'copy'" />
          <span pButtonLabel>{{
            (copied() ? 'users.tempPassword.copied' : 'platform.credentials.copyAll') | transloco
          }}</span>
        </button>
        <button pButton type="button" (click)="visible.set(false)">
          <span pButtonLabel>{{ 'common.done' | transloco }}</span>
        </button>
      </ng-template>
    </p-dialog>
  `,
})
export class CredentialsDialog {
  readonly visible = model(false);
  readonly title = input.required<string>();
  readonly text = input('');
  readonly params = input<Record<string, unknown>>({});
  readonly rows = input.required<CredentialRow[]>();

  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    const text = this.rows()
      .map((r) => `${this.transloco.translate(r.label)}: ${r.value}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
    } catch {
      this.notify.error('users.tempPassword.copyFailTitle', 'users.tempPassword.copyFailText');
    }
  }
}
