import { Component, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Drawer } from 'primeng/drawer';
import { Icon } from '../icon/icon';

/** Нижняя шторка для мобильной версии (карточка номера, фильтры, формы). */
@Component({
  selector: 'app-sheet',
  imports: [Drawer, Icon, TranslocoPipe],
  template: `
    <p-drawer
      [(visible)]="visible"
      position="bottom"
      [modal]="true"
      [blockScroll]="true"
      [showCloseIcon]="false"
      [styleClass]="'hs-sheet' + (full() ? ' hs-sheet-full' : '')"
      [header]="title() || label()"
    >
      <ng-template #headless>
        <div class="flex max-h-[inherit] min-h-0 flex-col" [class.h-full]="full()">
          @if (!full()) {
            <div
              class="mx-auto mt-2.5 mb-1 h-1 w-10 shrink-0 rounded-full bg-field"
              aria-hidden="true"
            ></div>
          }
          @if (title() || full()) {
            <div
              class="flex shrink-0 items-center gap-3 px-4 pt-2 pb-3"
              [class.border-b]="full()"
              [class.border-line-2]="full()"
            >
              @if (full()) {
                <button
                  type="button"
                  class="tap flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line-2 bg-white text-ink-2"
                  [attr.aria-label]="'common.close' | transloco"
                  (click)="visible.set(false)"
                >
                  <app-icon name="close" />
                </button>
              }
              <div class="min-w-0 flex-1">
                <h2 class="m-0 text-lg font-semibold">{{ title() }}</h2>
                @if (subtitle()) {
                  <p class="mt-0.5 mb-0 text-[13px] text-muted">{{ subtitle() }}</p>
                }
              </div>
              <ng-content select="[sheetHeaderEnd]" />
            </div>
          }
          <div class="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            <ng-content />
          </div>
          <div class="shrink-0 px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))]">
            <ng-content select="[sheetFooter]" />
          </div>
        </div>
      </ng-template>
    </p-drawer>
  `,
})
export class Sheet {
  readonly visible = model(false);
  readonly title = input('');
  readonly subtitle = input('');
  /** Подпись для экранных дикторов, если заголовок не задан. */
  readonly label = input('');
  /** Шторка на весь экран (длинные формы). */
  readonly full = input(false);
}
