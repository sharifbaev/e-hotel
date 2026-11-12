import {
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { FiscalReceiptData, downloadFiscalReceipt } from '../../../core/docs/fiscal-receipt-doc';
import { NotifyService } from '../../../core/notify/notify.service';
import { SettingsService } from '../../../core/data/settings.service';
import { Icon } from '../icon/icon';

/**
 * Стили бланка. Одна строка CSS используется и в модалке, и в окне печати,
 * поэтому классы с префиксом `fr-` и без инкапсуляции.
 */
const RECEIPT_CSS = `
.fr-sheet {
  box-sizing: border-box;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 20px 24px;
  font-family: Arial, 'Helvetica Neue', sans-serif;
  font-size: 12.5px;
  line-height: 1.4;
  color: #111;
  background: #fff;
}
.fr-head { text-align: center; }
.fr-org { font-size: 13px; font-weight: 700; }
.fr-hotel { font-size: 15px; font-weight: 700; letter-spacing: .02em; }
.fr-title { margin: 12px 0 2px; text-align: center; font-size: 15px; font-weight: 700; }
.fr-date { text-align: center; margin-bottom: 12px; }
.fr-meta { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
.fr-meta td { padding: 3px 0; vertical-align: top; }
.fr-meta td:first-child { width: 42%; color: #444; }
.fr-meta td:last-child { font-weight: 600; }
.fr-items { width: 100%; border-collapse: collapse; }
.fr-items th, .fr-items td { border: 1px solid #333; padding: 5px 7px; }
.fr-items th { font-size: 11.5px; font-weight: 700; text-align: center; background: #f3f4f6; }
.fr-items td.fr-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.fr-items tfoot td { font-weight: 700; }
.fr-words { margin-top: 8px; }
.fr-sign { margin-top: 22px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.fr-cut { margin: 18px 0; border-top: 1px dashed #888; }
@media print {
  @page { size: A4; margin: 10mm; }
  html, body { margin: 0; background: #fff; }
  /* Отступы по бокам, чтобы бланк не прилипал к краям листа. */
  .fr-sheet { max-width: none; padding: 6mm 15mm; break-inside: avoid; }
  .fr-items th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

/** Просмотр сохранённого фискального чека гостя: бланк, печать и скачивание Word. */
@Component({
  selector: 'app-fiscal-receipt-dialog',
  imports: [TranslocoPipe, ButtonModule, Dialog, Icon],
  encapsulation: ViewEncapsulation.None,
  styles: [RECEIPT_CSS],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [dismissableMask]="true"
      [header]="'receipt.title' | transloco: { number: receipt()?.number ?? '' }"
      [style]="{ width: '780px', maxWidth: 'calc(100vw - 32px)' }"
      [contentStyle]="{ maxHeight: 'calc(100dvh - 150px)' }"
      styleClass="hs-dialog"
      [closeAriaLabel]="'common.close' | transloco"
    >
      @if (receipt(); as r) {
        <div class="flex flex-col gap-2">
          <div class="overflow-x-auto rounded-xl border border-line bg-subtle p-3 max-sm:p-1.5">
            <div #sheet class="fr-sheet rounded-md shadow-sm">
              <div class="fr-head">
                @if (head().org) {
                  <div class="fr-org">{{ head().org }}</div>
                }
                @if (head().hotel) {
                  <div class="fr-hotel">{{ head().hotel }}</div>
                }
              </div>
              <div class="fr-title">ACCOUNT / СЧЁТ № {{ r.number }}</div>
              <div class="fr-date">Date / Дата: {{ r.date }}</div>
              <table class="fr-meta">
                <tbody>
                  <tr><td>Guest name / Имя гостя</td><td>{{ r.guests }}</td></tr>
                  <tr><td>Source name / Компания</td><td>{{ r.company }}</td></tr>
                  <tr><td>Room number / Номер</td><td>{{ r.room }}</td></tr>
                  <tr><td>Arrival / Заезд</td><td>{{ r.checkin }}</td></tr>
                  <tr><td>Departures / Выезд</td><td>{{ r.checkout }}</td></tr>
                </tbody>
              </table>
              <table class="fr-items">
                <thead>
                  <tr>
                    <th>Charges / Услуги</th>
                    <th>Number / Количество</th>
                    <th>Cost / Цена</th>
                    <th>Amount / Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  @for (it of r.items; track $index) {
                    <tr>
                      <td>{{ it.name }}</td>
                      <td class="fr-num">{{ it.qty }}</td>
                      <td class="fr-num">{{ it.price }}</td>
                      <td class="fr-num">{{ it.sum }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3">Total amount / Итого:</td>
                    <td class="fr-num">{{ r.amount }}</td>
                  </tr>
                </tfoot>
              </table>
              <div class="fr-words">In words / прописью: {{ r.amountWords }}</div>
              <div class="fr-sign">
                <span>Reception clerk / Подпись Деж. администратора</span>
                <span>______________________ {{ r.cashier }}</span>
              </div>
            </div>
          </div>
        </div>
      }
      <ng-template #footer>
        <button
          pButton
          type="button"
          severity="secondary"
          [outlined]="true"
          [loading]="downloading()"
          [disabled]="!receipt()"
          (click)="download()"
        >
          @if (!downloading()) {
            <app-icon name="download" />
          }
          <span pButtonLabel>{{ 'receipt.download' | transloco }}</span>
        </button>
        <button pButton type="button" [disabled]="!receipt()" (click)="print()">
          <app-icon name="printer" />
          <span pButtonLabel>{{ 'receipt.print' | transloco }}</span>
        </button>
      </ng-template>
    </p-dialog>
  `,
})
export class FiscalReceiptDialog {
  private readonly notify = inject(NotifyService);
  private readonly settings = inject(SettingsService);
  private readonly header = toSignal(this.settings.receiptHeader());

  /** Шапка всегда из актуальных настроек; пока они грузятся — то, что сохранено в чеке. */
  protected readonly head = computed(() => {
    const h = this.header();
    const r = this.receipt();
    return { org: h?.org || r?.org || '', hotel: h?.hotel || r?.hotel || '' };
  });

  readonly visible = model(false);
  readonly receipt = input<FiscalReceiptData | null>(null);

  protected readonly downloading = signal(false);
  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');

  /** Печать: бланк в скрытом iframe, один экземпляр на листе. */
  protected print(): void {
    const el = this.sheet()?.nativeElement;
    const r = this.receipt();
    if (!el || !r) {
      return;
    }
    const copy = el.outerHTML;
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.append(frame);
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!win || !doc) {
      frame.remove();
      this.notify.error('receipt.printFailTitle', 'receipt.printFailText');
      return;
    }
    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Счёт № ${r.number}</title>` +
        `<style>${RECEIPT_CSS}</style></head><body>${copy}</body></html>`,
    );
    doc.close();
    const cleanup = () => setTimeout(() => frame.remove(), 500);
    win.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        this.notify.error('receipt.printFailTitle', 'receipt.printFailText');
        frame.remove();
      }
    }, 60);
    // Запасной вариант, если afterprint не пришёл.
    setTimeout(() => frame.isConnected && frame.remove(), 60_000);
  }

  protected download(): void {
    const r = this.receipt();
    if (!r) {
      return;
    }
    this.downloading.set(true);
    downloadFiscalReceipt({ ...r, ...this.head() })
      .then(() => this.downloading.set(false))
      .catch(() => {
        this.downloading.set(false);
        this.notify.error('rooms.toast.receiptFailTitle', 'rooms.toast.receiptFailText');
      });
  }
}
