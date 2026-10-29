// "2026-09" -> the UTC start/end-of-day bounds of that calendar month.
export function periodToDateRange(period) {
    const [year, month] = period.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { start, end };
}
//# sourceMappingURL=types.js.map