// Dates follow the same UTC start / Vietnam end-of-day contract as control API.
export function renewalPeriod(
  start: string,
  end: string,
  previousEnd: string,
  now = Date.now(),
) {
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(start) || !validDate(end))
    throw new Error("Vui lòng nhập ngày bắt đầu và kết thúc hợp lệ.");
  const startAt = Date.parse(start);
  const endAt = Date.parse(`${end}T23:59:59+07:00`);
  if (end < start || endAt <= startAt)
    throw new Error("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
  if (endAt <= now) throw new Error("Ngày kết thúc kỳ mới phải ở tương lai.");
  if (startAt < Date.parse(previousEnd))
    throw new Error("Kỳ mới phải bắt đầu sau khi kỳ hiện tại kết thúc.");
  if (endAt - startAt > 367 * 24 * 60 * 60 * 1000)
    throw new Error("Một kỳ sử dụng không được dài hơn 367 ngày.");
  return { periodStart: start, periodEnd: new Date(endAt).toISOString() };
}

export function tenantPage(total: number, page: number, pageSize = 20) {
  return Math.max(0, Math.min(page, Math.ceil(total / pageSize) - 1));
}
