/**
 * Єдине джерело правил штрафу за прострочення. Використовується LoanService
 * (поля daysOverdue/fine у видачах) і StatsService (звіт про прострочені видачі),
 * щоб формула не дублювалась.
 */
export const FINE_PER_DAY_UAH = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Кількість днів прострочення: будь-яка неповна доба рахується як повна. */
export function overdueDays(dueDate, until) {
  const ms = until.getTime() - dueDate.getTime();
  return ms > 0 ? Math.ceil(ms / DAY_MS) : 0;
}

/**
 * Штраф за видачу з терміном dueDate станом на until.
 * @returns {{ daysOverdue: number, fine: number }} — нулі, якщо прострочення немає.
 */
export function calculateFine(dueDate, until) {
  const daysOverdue = overdueDays(dueDate, until);
  return { daysOverdue, fine: daysOverdue * FINE_PER_DAY_UAH };
}
