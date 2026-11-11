import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PaymentStatus, RoleCode, RoomStatus } from '../../../core/models';
import { PAY_TONE, ROOM_TONE, roleTone } from './status-styles';
import { RoleLabelPipe } from './role-label.pipe';

/** Бейдж статуса номера: точка + подпись. */
@Component({
  selector: 'app-room-status',
  imports: [TranslocoPipe],
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[13px] font-semibold"
      [style.background]="tone().bg"
      [style.color]="tone().fg"
    >
      <span class="size-[7px] rounded-full" [style.background]="tone().dot"></span>
      {{ 'rooms.status.' + status() | transloco }}
    </span>
  `,
})
export class RoomStatusBadge {
  readonly status = input.required<RoomStatus>();
  protected readonly tone = computed(() => ROOM_TONE[this.status()]);
}

/** Бейдж оплаты: оплачено / предоплата / ожидает. */
@Component({
  selector: 'app-pay-badge',
  imports: [TranslocoPipe],
  template: `
    <span
      class="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold"
      [style.background]="tone().bg"
      [style.color]="tone().fg"
    >
      {{ (short() ? 'pay.short.' : 'pay.') + status() | transloco }}
    </span>
  `,
})
export class PayBadge {
  readonly status = input.required<PaymentStatus>();
  /** Короткая подпись («Ожидает» вместо «Ожидает оплаты»). */
  readonly short = input(false);
  protected readonly tone = computed(() => PAY_TONE[this.status()]);
}

/** Бейдж роли сотрудника. */
@Component({
  selector: 'app-role-badge',
  imports: [RoleLabelPipe],
  template: `
    <span
      class="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold"
      [style.background]="tone().bg"
      [style.color]="tone().fg"
    >
      {{ role() | roleLabel }}
    </span>
  `,
})
export class RoleBadge {
  readonly role = input.required<RoleCode>();
  protected readonly tone = computed(() => roleTone(this.role()));
}
