function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

export function dateStrOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
