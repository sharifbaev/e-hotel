import { Component, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { NotifyService } from '../../../core/notify/notify.service';
import { Icon } from '../icon/icon';

/** Кнопка-иконка «Скопировать» (без текста): после копирования ~1,5 с показывает галочку. */
@Component({
  selector: 'app-copy-button',
  imports: [TranslocoPipe, ButtonModule, Tooltip, Icon],
  template: `
    <button
      pButton
      type="button"
      severity="secondary"
      [outlined]="true"
      class="shrink-0"
      [disabled]="!value()"
      [attr.aria-label]="(copied() ? 'common.copied' : 'common.copy') | transloco"
      [pTooltip]="(copied() ? 'common.copied' : 'common.copy') | transloco"
      tooltipPosition="top"
      (click)="copy()"
    >
      <app-icon [name]="copied() ? 'check' : 'copy'" />
    </button>
  `,
})
export class CopyButton {
  /** Что копировать. */
  readonly value = input('');

  private readonly notify = inject(NotifyService);
  protected readonly copied = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.value());
      this.copied.set(true);
      if (this.timer) {
        clearTimeout(this.timer);
      }
      this.timer = setTimeout(() => this.copied.set(false), 1500);
    } catch {
      this.notify.error('users.tempPassword.copyFailTitle', 'users.tempPassword.copyFailText');
    }
  }
}
