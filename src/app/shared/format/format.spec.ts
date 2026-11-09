import {
  addDays,
  diffDays,
  formatDmy,
  formatSum,
  formatSumInput,
  initials,
  parseSum,
  weekdayIndex,
} from './format';
import { pluralForm } from './format.pipes';

describe('format', () => {
  it('formats sums with grouped thousands', () => {
    expect(formatSum(4100000)).toBe('4 100 000');
    expect(formatSumInput('4100000abc')).toBe('4 100 000');
    expect(parseSum('4 100 000')).toBe(4100000);
  });

  it('works with ISO dates', () => {
    expect(formatDmy('2026-10-26')).toBe('26.10.2026');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(diffDays('2026-10-20', '2026-10-26')).toBe(6);
    expect(weekdayIndex('2026-10-26')).toBe(0);
  });

  it('builds initials and Russian plural forms', () => {
    expect(initials('Дилноза Каримова')).toBe('ДК');
    expect(pluralForm(1)).toBe('one');
    expect(pluralForm(3)).toBe('few');
    expect(pluralForm(11)).toBe('many');
    expect(pluralForm(22)).toBe('few');
  });
});
