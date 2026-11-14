import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { ApiError, APP_TODAY } from '../../core/api/mock-api';
import { BookService } from '../../core/data/book.service';
import { DebtsService } from '../../core/data/debts.service';
import { StaffService } from '../../core/data/staff.service';
import { FiscalReceiptData } from '../../core/docs/fiscal-receipt-doc';
import { MIXED_PAYMENT, Room } from '../../core/models';
import { PaymentTypesService } from '../../core/data/payment-types.service';
import { PayLabelPipe } from '../../shared/format/pay-label.pipe';
import { Select } from 'primeng/select';
import { NotifyService } from '../../core/notify/notify.service';
import { formatDmy, formatSum, initials, localDateTimeSecToIso } from '../../shared/format/format';
import { DayMonthPipe, SumPipe } from '../../shared/format/format.pipes';
import { sumInWords } from '../../shared/format/sum-in-words';
import { SumInputDirective } from '../../shared/forms/sum-input.directive';
import { FiscalReceiptDialog } from '../../shared/ui/fiscal-receipt/fiscal-receipt-dialog';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * Выселение (закрытие клиента): выбор гостей, итоговая сумма, фискальный чек, чёрный список.
 * Общее окно для «Номеров» и «Книги». После выселения — checkedOut с обновлённым номером.
 */
@Component({
  selector: 'app-checkout-dialog',
  imports: [
    FormsModule,
    TranslocoPipe,
    ButtonModule,
    Checkbox,
    Dialog,
    InputText,
    Textarea,
    Icon,
    SumInputDirective,
    SumPipe,
    DayMonthPipe,
    FiscalReceiptDialog,
    Select,
    PayLabelPipe,
  ],
  templateUrl: './checkout-dialog.html',
})
export class CheckoutDialog {
  private readonly book = inject(BookService);
  private readonly staff = inject(StaffService);
  private readonly notify = inject(NotifyService);
  private readonly today = inject(APP_TODAY);
  private readonly payTypes = inject(PaymentTypesService);
  private readonly debts = inject(DebtsService);
  private readonly transloco = inject(TranslocoService);

  /** Способ оплаты при выселении (справочник «Способ оплаты»). */
  protected readonly payments = computed(() => this.payTypes.items().map((t) => t.code));
  protected readonly payment = signal<string>('cash');
  protected readonly mixed = computed(() => this.payment() === MIXED_PAYMENT);
  /** «Смешанный»: сколько картой и сколько наличными; итоговая сумма = их сумма. */
  protected readonly paidCard = signal<number | null>(null);
  protected readonly paidCash = signal<number | null>(null);

  /** Номер после выселения (гостей стало меньше или номер ушёл на уборку). */
  readonly checkedOut = output<Room>();
  protected readonly busy = signal(false);

  protected readonly checkoutOpen = signal(false);
  protected readonly checkoutRoom = signal<Room | null>(null);
  /** Документы отмеченных к выселению гостей. */
  protected readonly checkoutDocs = signal<string[]>([]);
  /** «К оплате» за проживание: стоимость за день × дни (по отмеченным гостям), можно изменить. */
  protected readonly checkoutAmount = signal<number | null>(null);
  /** «Сумма» — сколько гость платит при выселении (по умолчанию К оплате − Предоплата). */
  protected readonly paid = signal<number | null>(null);
  /** Отмеченные к выселению гости. */
  private readonly leaving = computed(() => {
    const room = this.checkoutRoom();
    const docs = this.checkoutDocs();
    return room ? room.guests.filter((g) => docs.includes(g.doc)) : [];
  });
  /** Расчёт «стоимость за день × дни» для подсказки: «300 000 × 3 + 250 000 × 2». */
  protected readonly calc = computed(() =>
    this.leaving()
      .map((g) => `${formatSum(g.sum)} × ${nightsBetween(g.checkin, this.today)}`)
      .join(' + '),
  );
  /** Предоплата отмеченных гостей. */
  protected readonly prepayment = computed(() =>
    this.leaving().reduce((s, g) => s + (g.prepayment ?? 0), 0),
  );
  /** Остаток после предоплаты: К оплате − Предоплата (не меньше 0). */
  private readonly remaining = computed(() =>
    Math.max(0, (this.checkoutAmount() ?? 0) - this.prepayment()),
  );
  /** Долг: Предоплата + Сумма меньше, чем К оплате. */
  protected readonly debt = computed(() =>
    Math.max(0, (this.checkoutAmount() ?? 0) - this.prepayment() - (this.paid() ?? 0)),
  );
  /** Подтверждение «выселить с долгом»: причина обязательна (как в «Долгах»). */
  protected readonly debtOpen = signal(false);
  protected readonly debtReason = signal('');
  protected readonly debtTried = signal(false);
  protected readonly debtReasonInvalid = computed(
    () => this.debtTried() && !this.debtReason().trim(),
  );
  /** ФИО выселяемых гостей — должник. */
  protected readonly debtor = computed(() =>
    this.leaving()
      .map((g) => g.name)
      .join(', '),
  );
  /** Номер сформированного фискального чека. */
  protected readonly receipt = signal<string | null>(null);
  protected readonly receiptBusy = signal(false);
  /** Данные последнего чека — для повторного просмотра и сохранения в архив. */
  private receiptData: FiscalReceiptData | null = null;
  /** Окно просмотра чека (как в «Книге» и «Архиве»): скачать Word / печать. */
  protected readonly receiptOpen = signal(false);
  protected readonly receiptView = signal<FiscalReceiptData | null>(null);
  protected readonly toBlacklist = signal(false);
  protected readonly blacklistReason = signal('');
  protected readonly checkoutTried = signal(false);
  protected readonly checkoutAll = computed(() => {
    const room = this.checkoutRoom();
    return !!room && room.guests.every((g) => this.checkoutDocs().includes(g.doc));
  });

  /**
   * Открыть выселение номера. docs — кого отметить сразу (из «Книги» — выбранного гостя);
   * по умолчанию — всех гостей номера. Сумма — по отмеченным гостям.
   */
  open(room: Room, docs?: string[]): void {
    const marked = docs?.length ? docs : room.guests.map((g) => g.doc);
    this.checkoutRoom.set(room);
    this.checkoutDocs.set(marked);
    this.recalc();
    this.payTypes.ensureLoaded();
    this.payment.set('cash');
    this.paidCard.set(null);
    this.paidCash.set(null);
    this.receipt.set(null);
    this.receiptData = null;
    this.toBlacklist.set(false);
    this.blacklistReason.set('');
    this.checkoutTried.set(false);
    this.debtOpen.set(false);
    this.checkoutOpen.set(true);
  }

  protected isChecked(doc: string): boolean {
    return this.checkoutDocs().includes(doc);
  }

  protected toggleGuest(doc: string, on: boolean): void {
    this.checkoutDocs.update((list) =>
      on ? [...new Set([...list, doc])] : list.filter((d) => d !== doc),
    );
    this.recalc();
  }

  protected toggleAllGuests(on: boolean): void {
    const room = this.checkoutRoom();
    this.checkoutDocs.set(on && room ? room.guests.map((g) => g.doc) : []);
    this.recalc();
  }

  /** Сумма по отмеченным гостям: стоимость за день × количество дней. */
  private recalc(): void {
    const sum = this.leaving().reduce(
      (s, g) => s + g.sum * nightsBetween(g.checkin, this.today),
      0,
    );
    this.setAmount(sum || null);
  }

  /** Смена способа: для «Смешанный» «К оплате» сначала вся «картой» — дальше делится вручную. */
  protected setPayment(code: string): void {
    this.payment.set(code);
    if (code === MIXED_PAYMENT) {
      this.splitToCard();
    }
  }

  /** Части смешанной оплаты: «Картой» + «Наличными» = «Сумма» (второе поле подстраивается). */
  protected setPart(part: 'card' | 'cash', v: number | null): void {
    const rest = v === null ? null : Math.max(0, (this.paid() ?? 0) - v) || null;
    if (part === 'card') {
      this.paidCard.set(v);
      this.paidCash.set(rest);
    } else {
      this.paidCash.set(v);
      this.paidCard.set(rest);
    }
  }

  /** «К оплате» (только чтение, считается по гостям) — «Сумма» снова равна остатку после предоплаты. */
  private setAmount(v: number | null): void {
    this.checkoutAmount.set(v);
    this.setPaid(this.remaining() || null);
  }

  /** «Сумма» изменилась — ранее выданный чек уже не соответствует. */
  protected setPaid(v: number | null): void {
    this.paid.set(v);
    this.receipt.set(null);
    this.receiptData = null;
    if (this.mixed()) {
      this.splitToCard();
    }
  }

  private splitToCard(): void {
    this.paidCard.set(this.paid() || null);
    this.paidCash.set(null);
  }

  protected generateReceipt(): void {
    const room = this.checkoutRoom();
    // Чек — на «Сумму», которую гость платит при выселении.
    const amount = this.checkoutAmount() ?? 0;
    const prepayment = this.prepayment();
    const toPay = this.paid() ?? 0;
    const debt = this.debt();
    if (!room || !toPay) {
      this.notify.error('rooms.toast.receiptNoSumTitle', 'rooms.toast.receiptNoSumText');
      return;
    }
    const docs = this.checkoutDocs();
    const leaving = room.guests.filter((g) => docs.includes(g.doc));
    this.receiptBusy.set(true);
    this.book.fiscalReceipt(room.number, toPay, docs).subscribe({
      next: (r) => {
        const checkin = leaving.reduce(
          (min, g) => (!min || g.checkin < min ? g.checkin : min),
          '',
        );
        const nights = nightsBetween(checkin, this.today);
        // Одна цена за день — строка «цена × дни»; разные — средняя цена за день.
        const prices = [...new Set(leaving.map((g) => g.sum))];
        const first = leaving[0]?.name ?? '';
        // Бланк гостиницы на русском/английском — текст строк не зависит от языка интерфейса.
        this.receiptData = {
          number: r.number,
          date: formatDmy(this.today),
          guests: leaving.length > 1 ? `${first} (+${leaving.length - 1})` : first,
          company: '_'.repeat(28),
          room: room.number,
          checkin: formatDmy(checkin),
          checkout: formatDmy(this.today),
          items: [
            {
              name: `Проживание · ${room.category}`,
              qty: String(nights),
              price: formatSum(
                prices.length === 1 && prices[0] * nights === amount
                  ? prices[0]
                  : Math.round(amount / nights),
              ),
              sum: formatSum(amount),
            },
            // Предоплата вычитается — итог чека = «К оплате».
            ...(prepayment > 0
              ? [{ name: 'Предоплата', qty: '', price: '', sum: `− ${formatSum(prepayment)}` }]
              : []),
            ...(debt > 0
              ? [{ name: 'Долг', qty: '', price: '', sum: `− ${formatSum(debt)}` }]
              : []),
          ],
          amount: formatSum(toPay),
          amountWords: sumInWords(toPay),
          cashier: this.staff.myName(),
        };
        this.receipt.set(r.number);
        this.receiptBusy.set(false);
        this.showReceipt();
      },
      error: (e: unknown) => {
        this.receiptBusy.set(false);
        this.notify.error(
          'common.saveError',
          e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
        );
      },
    });
  }

  /** Показать сформированный чек в окне (там — «Скачать» и «Печать»). */
  protected showReceipt(): void {
    if (this.receiptData) {
      this.receiptView.set(this.receiptData);
      this.receiptOpen.set(true);
    }
  }

  protected reasonInvalid(): boolean {
    return this.checkoutTried() && this.toBlacklist() && !this.blacklistReason().trim();
  }

  protected confirmCheckout(): void {
    const room = this.checkoutRoom();
    const docs = this.checkoutDocs();
    if (!room || !docs.length) {
      return;
    }
    this.checkoutTried.set(true);
    if (this.reasonInvalid()) {
      this.notify.error('common.requiredTitle', 'blacklist.toast.required');
      return;
    }
    // Предоплата + Сумма меньше, чем К оплате — сначала подтверждение с причиной долга.
    if (this.debt() > 0) {
      this.debtReason.set(
        this.transloco.translate('rooms.debt.reasonDefault', { room: room.number }),
      );
      this.debtTried.set(false);
      this.debtOpen.set(true);
      return;
    }
    this.doCheckout(null);
  }

  /** «Выселить и записать в долг». */
  protected confirmDebt(): void {
    this.debtTried.set(true);
    if (this.debtReasonInvalid()) {
      this.notify.error('common.requiredTitle', 'rooms.debt.reasonRequired');
      return;
    }
    this.doCheckout(this.debtReason().trim());
  }

  /** Выселение; debtReason — после успеха записать недоплату в «Долги». */
  private doCheckout(debtReason: string | null): void {
    const room = this.checkoutRoom();
    const docs = this.checkoutDocs();
    if (!room || !docs.length) {
      return;
    }
    const leaving = room.guests.filter((g) => docs.includes(g.doc));
    const debt = debtReason !== null ? this.debt() : 0;
    const debtor = this.debtor();
    const banned = this.toBlacklist();
    this.busy.set(true);
    this.book
      .checkout(room.number, docs, {
        amount: this.checkoutAmount() ?? 0,
        prepayment: this.prepayment(),
        paid: this.paid() ?? 0,
        debt,
        payment: this.payment(),
        paidCard: this.mixed() ? (this.paidCard() ?? 0) : null,
        paidCash: this.mixed() ? (this.paidCash() ?? 0) : null,
        receipt: this.receipt(),
        receiptData: this.receipt() ? this.receiptData : null,
        blacklistReason: banned ? this.blacklistReason().trim() : null,
      })
      .subscribe({
      next: (updated) => {
        this.checkedOut.emit(updated);
        this.busy.set(false);
        this.debtOpen.set(false);
        this.checkoutOpen.set(false);
        if (debt > 0 && debtReason !== null) {
          this.saveDebt(debtor, debtReason, debt);
        }
        if (updated.guests.length) {
          this.notify.success('rooms.toast.checkedOutPartTitle', 'rooms.toast.checkedOutPartText', {
            count: leaving.length,
            room: room.number,
            left: updated.guests.length,
          });
        } else {
          this.notify.success('rooms.toast.checkedOutTitle', 'rooms.toast.checkedOutText', {
            name: leaving.map((g) => g.name).join(', '),
            room: room.number,
          });
        }
        if (banned) {
          setTimeout(
            () =>
              this.notify.success('blacklist.toast.addedTitle', 'blacklist.toast.addedText', {
                name: leaving.map((g) => g.name).join(', '),
              }),
            2500,
          );
        }
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  /** Недоплата → таблица «Платежи и расходы → Долги». */
  private saveDebt(debtor: string, reason: string, sum: number): void {
    this.debts
      .create({
        debtor,
        reason,
        sum,
        date: localDateTimeSecToIso(new Date()) ?? `${this.today}T00:00:00`,
        who: this.staff.myName(),
      })
      .subscribe({
        next: () =>
          setTimeout(
            () =>
              this.notify.success('rooms.debt.savedTitle', 'rooms.debt.savedText', {
                name: debtor,
                sum: formatSum(sum),
              }),
            4500,
          ),
        error: () =>
          this.notify.error('rooms.debt.saveErrorTitle', 'rooms.debt.saveErrorText', {
            name: debtor,
            sum: formatSum(sum),
          }),
      });
  }

  protected guestInitials(name: string): string {
    return initials(name);
  }

  private fail(e?: unknown): void {
    this.busy.set(false);
    this.notify.error(
      'common.saveError',
      e instanceof ApiError ? `errors.${e.code}` : 'errors.common.unknown',
    );
  }
}

/** Количество ночей между датой заезда и выезда (минимум 1). */
function nightsBetween(checkin: string, checkout: string): number {
  if (!checkin) {
    return 1;
  }
  const a = Date.UTC(+checkin.slice(0, 4), +checkin.slice(5, 7) - 1, +checkin.slice(8, 10));
  const b = Date.UTC(+checkout.slice(0, 4), +checkout.slice(5, 7) - 1, +checkout.slice(8, 10));
  return Math.max(1, Math.round((b - a) / 86_400_000));
}
