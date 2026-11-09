import { Component, input, model, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Icon } from '../icon/icon';

/** Подтверждение опасного действия (удаление). Красная иконка, «Отмена» / «Удалить». */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Dialog, ButtonModule, Icon, TranslocoPipe],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closable]="false"
      [showHeader]="false"
      [dismissableMask]="!busy()"
      [style]="{ width: '400px', maxWidth: 'calc(100vw - 32px)' }"
      [role]="'alertdialog'"
    >
      <div class="flex flex-col items-center gap-4 pt-6 text-center">
        <div class="flex size-14 items-center justify-center rounded-full bg-[#FEE4E2] text-danger">
          <app-icon name="trash" [size]="26" />
        </div>
        <div class="flex flex-col gap-1.5">
          <h2 [id]="titleId" class="m-0 text-lg font-semibold">
            {{ title() | transloco: params() }}
          </h2>
          <p class="m-0 text-sm leading-normal text-muted">{{ text() | transloco: params() }}</p>
        </div>
        <div class="flex w-full gap-2.5">
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            class="flex-1"
            [disabled]="busy()"
            (click)="visible.set(false)"
          >
            <span pButtonLabel>{{ 'common.cancel' | transloco }}</span>
          </button>
          <button
            pButton
            type="button"
            severity="danger"
            class="flex-1"
            [loading]="busy()"
            (click)="confirm.emit()"
          >
            @if (!busy()) {
              <app-icon name="trash" />
            }
            <span pButtonLabel>{{ confirmLabel() | transloco }}</span>
          </button>
        </div>
      </div>
    </p-dialog>
  `,
})
export class ConfirmDialog {
  readonly visible = model(false);
  readonly title = input.required<string>();
  readonly text = input.required<string>();
  readonly params = input<Record<string, unknown>>({});
  readonly confirmLabel = input('common.delete');
  readonly busy = input(false);
  readonly confirm = output<void>();

  protected readonly titleId = `confirm-${Math.random().toString(36).slice(2, 8)}`;
}
