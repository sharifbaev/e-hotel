import { Component, input, model, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { BlacklistEntry } from '../../core/models';
import { DmyPipe } from '../../shared/format/format.pipes';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * Предупреждение: документ гостя найден в чёрном списке.
 * Показывает причину; сотрудник решает — отменить или всё равно продолжить.
 */
@Component({
  selector: 'app-blacklist-warning',
  imports: [TranslocoPipe, ButtonModule, Dialog, Icon, DmyPipe],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [closable]="false"
      [showHeader]="false"
      [style]="{ width: '460px', maxWidth: 'calc(100vw - 32px)' }"
      [role]="'alertdialog'"
    >
      <div class="flex flex-col gap-4 pt-6">
        <div class="flex flex-col items-center gap-3 text-center">
          <div class="flex size-14 items-center justify-center rounded-full bg-[#FEE4E2] text-danger">
            <app-icon name="alert" [size]="28" [stroke]="2" />
          </div>
          <h2 class="m-0 text-lg font-semibold">
            {{ (entries().length > 1 ? 'blacklist.warnTitleMany' : 'blacklist.warnTitle') | transloco }}
          </h2>
          <p class="m-0 text-sm leading-normal text-muted">{{ 'blacklist.warnText' | transloco }}</p>
        </div>
        <ul class="m-0 flex list-none flex-col gap-2 p-0">
          @for (e of entries(); track e.id) {
            <li class="flex flex-col gap-1 rounded-xl border border-danger-line bg-danger-soft p-3.5">
              <span class="text-[15px] font-semibold text-ink"
                >{{ e.lastName }} {{ e.firstName }} {{ e.middleName }}</span
              >
              <span class="text-xs text-muted"
                >{{ e.doc }} · {{ 'blacklist.addedOn' | transloco: { date: (e.addedAt | dmy), who: e.addedBy } }}</span
              >
              <span class="text-sm leading-normal text-danger">{{ e.reason }}</span>
            </li>
          }
        </ul>
        <div class="flex w-full gap-2.5">
          <button
            pButton
            type="button"
            severity="secondary"
            [outlined]="true"
            class="flex-1"
            (click)="visible.set(false)"
          >
            <span pButtonLabel>{{ 'common.cancel' | transloco }}</span>
          </button>
          <button
            pButton
            type="button"
            severity="danger"
            class="flex-1"
            (click)="visible.set(false); proceed.emit()"
          >
            <span pButtonLabel>{{ 'blacklist.proceed' | transloco }}</span>
          </button>
        </div>
      </div>
    </p-dialog>
  `,
})
export class BlacklistWarning {
  readonly visible = model(false);
  readonly entries = input<BlacklistEntry[]>([]);
  readonly proceed = output<void>();
}
