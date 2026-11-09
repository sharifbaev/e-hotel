import { Component, signal } from '@angular/core';
import { IOverlayAngularComp } from 'ag-grid-angular';
import { IOverlayParams } from 'ag-grid-community';
import { EmptyState } from '../ui/empty-state/empty-state';

export interface GridEmptyParams {
  /** Ключ i18n текста, когда данных нет совсем. */
  emptyText: string;
  /** Ключ i18n текста, когда ничего не нашлось по фильтрам. */
  noMatchText: string;
}

/** Оверлей AG Grid «Нет данных»; при активных фильтрах — кнопка «Сбросить фильтры». */
@Component({
  selector: 'app-grid-empty-overlay',
  imports: [EmptyState],
  template: `
    <div class="pointer-events-auto">
      <app-empty-state
        [compact]="true"
        [text]="filtered() ? noMatchText() : emptyText()"
        [actionLabel]="filtered() ? 'common.resetFilters' : ''"
        (action)="reset()"
      />
    </div>
  `,
})
export class GridEmptyOverlay implements IOverlayAngularComp {
  protected readonly filtered = signal(false);
  protected readonly emptyText = signal('');
  protected readonly noMatchText = signal('');
  private params: IOverlayParams | null = null;

  agInit(params: IOverlayParams & GridEmptyParams): void {
    this.params = params;
    this.filtered.set(params.overlayType === 'noMatchingRows');
    this.emptyText.set(params.emptyText);
    this.noMatchText.set(params.noMatchText);
  }

  refresh(params: IOverlayParams & GridEmptyParams): void {
    this.agInit(params);
  }

  protected reset(): void {
    this.params?.api.setFilterModel(null);
  }
}
