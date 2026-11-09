import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IOverlayAngularComp } from 'ag-grid-angular';

/** Оверлей AG Grid «Загрузка…»: круглый индикатор по центру таблицы. */
@Component({
  selector: 'app-grid-loading-overlay',
  imports: [TranslocoPipe],
  template: `
    <div class="flex flex-col items-center gap-3 py-6" role="status" aria-live="polite">
      <svg
        class="spin text-accent"
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="20" cy="20" r="16" stroke="#EAECF0" stroke-width="4" />
        <path
          d="M20 4a16 16 0 0 1 16 16"
          stroke="currentColor"
          stroke-width="4"
          stroke-linecap="round"
        />
      </svg>
      <span class="text-sm font-medium text-muted">{{ 'common.loading' | transloco }}</span>
    </div>
  `,
})
export class GridLoadingOverlay implements IOverlayAngularComp {
  agInit(): void {
    // Параметры не нужны.
  }

  refresh(): void {
    // Нечего обновлять.
  }
}
