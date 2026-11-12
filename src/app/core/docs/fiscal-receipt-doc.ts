import { formatDmy, formatSum } from '../../shared/format/format';
import { sumInWords } from '../../shared/format/sum-in-words';

/**
 * Данные для бланка счёта (public/templates/fiscal-receipt.docx — шаблон гостиницы,
 * два экземпляра на листе). Значения подставляются в оба экземпляра.
 */
export interface FiscalReceiptData {
  /** Шапка бланка: юр. лицо и название гостиницы — из «Настройки → Отель» (при показе подставляются актуальные). */
  org?: string;
  hotel?: string;
  number: string;
  date: string;
  /** Гость (если гостей несколько — «Фамилия Имя (+2)»). */
  guests: string;
  company: string;
  room: string;
  checkin: string;
  checkout: string;
  /** Строки таблицы «Услуги». */
  items: { name: string; qty: string; price: string; sum: string }[];
  amount: string;
  amountWords: string;
  cashier: string;
}

export const FISCAL_TEMPLATE_URL = 'templates/fiscal-receipt.docx';

/**
 * Формирует Word-документ по шаблону и скачивает его.
 * Теги шаблона: {org} {hotel} {number} {date} {guests} {company} {room} {checkin} {checkout}
 * {amount} {amountWords} {cashier}, строки услуг — {#items}{name} {qty} {price} {sum}{/items}.
 * Чтобы поменять бланк, замените .docx, сохранив теги.
 */
export async function downloadFiscalReceipt(data: FiscalReceiptData): Promise<void> {
  const [{ default: PizZip }, { default: Docxtemplater }, res] = await Promise.all([
    import('pizzip'),
    import('docxtemplater'),
    fetch(FISCAL_TEMPLATE_URL),
  ]);
  if (!res.ok) {
    throw new Error(`template ${res.status}`);
  }
  const zip = new PizZip(await res.arrayBuffer());
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Тег, которого нет в данных, остаётся пустым, а не ломает документ.
    nullGetter: () => '',
  });
  doc.render(data);
  const blob: Blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `schet-${data.number}.docx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ночей между датами (ISO), минимум 1. */
function nightsBetween(checkin: string, checkout: string): number {
  const d = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.max(1, Math.round((d(checkout) - d(checkin)) / 86_400_000));
}

/**
 * Данные чека на проживание одного гостя (галочка «Сохранить фискальный чек» при заселении).
 * Текст строк — на русском, как в бланке гостиницы.
 */
export function buildStayReceipt(o: {
  number: string;
  /** Дата выдачи чека (ISO). */
  date: string;
  guest: string;
  room: string;
  category: string;
  checkin: string;
  /** null — гость ещё не выселен: количество ночей 1, графа «Выезд» пустая. */
  checkout: string | null;
  amount: number;
  cashier: string;
  /** Шапка бланка из настроек гостиницы. */
  org?: string;
  hotel?: string;
}): FiscalReceiptData {
  const nights = o.checkout ? nightsBetween(o.checkin, o.checkout) : 1;
  return {
    number: o.number,
    date: formatDmy(o.date),
    guests: o.guest,
    company: '_'.repeat(28),
    room: o.room,
    checkin: formatDmy(o.checkin),
    checkout: o.checkout ? formatDmy(o.checkout) : '',
    org: o.org ?? '',
    hotel: o.hotel ?? '',
    items: [
      {
        name: o.category ? `Проживание · ${o.category}` : 'Проживание',
        qty: String(nights),
        price: formatSum(Math.round(o.amount / nights)),
        sum: formatSum(o.amount),
      },
    ],
    amount: formatSum(o.amount),
    amountWords: sumInWords(o.amount),
    cashier: o.cashier,
  };
}
