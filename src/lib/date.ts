export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function quarterLabel(iso: string): string {
  const d = new Date(iso);
  const quarterStart = Math.floor(d.getMonth() / 3) * 3;
  const start = new Date(d.getFullYear(), quarterStart, 1);
  const end = new Date(d.getFullYear(), quarterStart + 2, 1);
  const startMonth = start.toLocaleDateString(undefined, { month: "short" });
  const endMonth = end.toLocaleDateString(undefined, { month: "short" });
  return `${startMonth} - ${endMonth} ${d.getFullYear()}`;
}
