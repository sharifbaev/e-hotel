import { Pipe, PipeTransform, inject } from '@angular/core';
import { PaymentTypesService } from '../../core/data/payment-types.service';
import { LanguageService } from '../../core/i18n/language.service';

/** Название типа оплаты по коду: `{{ r.reg.payment | payLabel }}`. */
@Pipe({ name: 'payLabel', pure: false })
export class PayLabelPipe implements PipeTransform {
  private readonly types = inject(PaymentTypesService);
  private readonly lang = inject(LanguageService);

  transform(code: string | null | undefined): string {
    this.lang.current();
    return this.types.label(code);
  }
}
