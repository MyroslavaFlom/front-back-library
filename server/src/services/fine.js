export const FINE_PER_DAY_UAH = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export function overdueDays(dueDate, until) {
  const ms = until.getTime() - dueDate.getTime();
  return ms > 0 ? Math.ceil(ms / DAY_MS) : 0;
}

export function calculateFine(dueDate, until) {
  const daysOverdue = overdueDays(dueDate, until);
  return { daysOverdue, fine: daysOverdue * FINE_PER_DAY_UAH };
}
