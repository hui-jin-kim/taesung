export function calcExpiry(completedAt: number, termMonths: number) {
  const d = new Date(completedAt);
  d.setMonth(d.getMonth() + termMonths);
  return d.getTime();
}

export function monthsLeft(expiry: number, now: number = Date.now()) {
  const diff = (expiry - now) / (1000 * 60 * 60 * 24 * 30);
  return Math.ceil(diff);
}

