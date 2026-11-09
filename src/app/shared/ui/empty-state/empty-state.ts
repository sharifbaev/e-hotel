import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon, IconName } from '../icon/icon';

/** Пустое состояние «Нет данных» с необязательной кнопкой сброса фильтров. */
@Component({
  selector: 'app-empty-state',
  imports: [Icon, TranslocoPipe],
  template: `
    <div
      class="rise flex flex-col items-center gap-2.5 px-5 text-center"
      [class]="compact() ? 'py-6' : 'py-14'"
    >
      <div class="flex size-14 items-center justify-center rounded-full bg-chip text-[#667085]">
        <app-icon [name]="icon()" [size]="26" [stroke]="1.8" />
      </div>
      <span class="text-[15px] font-semibold">{{ title() | transloco }}</span>
      @if (text()) {
        <span class="max-w-80 text-[13px] text-muted">{{ text() | transloco }}</span>
      }
      @if (actionLabel()) {
        <button
          type="button"
          class="mt-1 inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-field bg-white px-3.5 text-sm font-medium text-ink-2 transition-colors hover:bg-chip"
          (click)="action.emit()"
        >
          <app-icon name="close" [size]="16" />
          {{ actionLabel() | transloco }}
        </button>
      }
    </div>
  `,
})
export class EmptyState {
  readonly title = input('common.noData');
  readonly text = input('');
  readonly icon = input<IconName>('list-search');
  readonly actionLabel = input('');
  /** Меньше отступы (внутри таблицы). */
  readonly compact = input(false);
  readonly action = output<void>();
}
