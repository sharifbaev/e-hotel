const ONES_M = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const ONES_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const TEENS = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
];
const TENS = [
  '',
  '',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто',
];
const HUNDREDS = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот',
];

/** Разряды: формы one/few/many и род (тысяча — женский). */
const SCALES: { forms: [string, string, string]; female: boolean }[] = [
  { forms: ['', '', ''], female: false },
  { forms: ['тысяча', 'тысячи', 'тысяч'], female: true },
  { forms: ['миллион', 'миллиона', 'миллионов'], female: false },
  { forms: ['миллиард', 'миллиарда', 'миллиардов'], female: false },
];

/** Русское правило: 1 тысяча, 2–4 тысячи, 5+ тысяч (11–14 — «тысяч»). */
function pluralIndex(n: number): 0 | 1 | 2 {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return 0;
  }
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 1 : 2;
}

function triad(n: number, female: boolean): string[] {
  const words = [HUNDREDS[Math.floor(n / 100)]];
  const rest = n % 100;
  if (rest >= 10 && rest < 20) {
    words.push(TEENS[rest - 10]);
  } else {
    words.push(TENS[Math.floor(rest / 10)], (female ? ONES_F : ONES_M)[rest % 10]);
  }
  return words.filter(Boolean);
}

/**
 * Сумма прописью для счёта (по-русски, как в бланке): 4 800 000 → «Четыре миллиона восемьсот тысяч сум».
 */
export function sumInWords(value: number, currency = 'сум'): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) {
    return `Ноль ${currency}`;
  }
  const parts: string[] = [];
  for (let i = 0; n > 0 && i < SCALES.length; i++) {
    const chunk = n % 1000;
    n = Math.floor(n / 1000);
    if (chunk === 0) {
      continue;
    }
    const scale = SCALES[i];
    const form = scale.forms[pluralIndex(chunk)];
    parts.unshift([...triad(chunk, scale.female), form].filter(Boolean).join(' '));
  }
  const text = `${parts.join(' ')} ${currency}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
