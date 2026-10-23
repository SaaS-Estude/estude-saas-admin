import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function load(file) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", code)(() => ({}), compiled, compiled.exports);
  return compiled.exports;
}
const b = load("lib/billing-public.ts");
const offer = (month, year) => ({ id: "1", code: "basic", name: "Cơ bản", description: "", tier: 1, limits: {}, features: {}, prices: { MONTH: month, YEAR: year } });

test("yearly savings are computed from the catalogue, rounded down", () => {
  assert.deepEqual(b.yearlySavings(offer(299000, 2990000)), { amount: 598000, percent: 16 });
  assert.deepEqual(b.yearlySavings(offer(100, 1200)), { amount: 0, percent: 0 });
  assert.deepEqual(b.yearlySavings({ ...offer(100, 0), prices: { MONTH: 100 } }), { amount: 0, percent: 0 });
  assert.equal(b.monthlyEquivalent(offer(299000, 2990000), "YEAR"), 249167);
  assert.equal(b.monthlyEquivalent(offer(299000, 2990000), "MONTH"), 299000);
  assert.equal(b.monthlyEquivalent({ ...offer(1, 1), prices: {} }, "YEAR"), undefined);
});

test("formatters", () => {
  assert.match(b.formatVnd(299000), /^299[.  ]000 ₫$/u);
  assert.equal(b.formatStorage(5 * 1024 ** 3), "5 GB");
  assert.equal(b.formatStorage(512 * 1024 ** 2), "512 MB");
  assert.match(b.formatCount(5_000_000), /^5 triệu$/);
  assert.equal(b.cycleLabel("YEAR"), "năm");
  assert.equal(b.cycleLabel("MONTH"), "tháng");
});

test("slug suggestion strips Vietnamese diacritics", () => {
  assert.equal(b.suggestSlug("Trường THPT Lê Quý Đôn"), "truong-thpt-le-quy-don");
  assert.equal(b.suggestSlug("  --Đại học!!  "), "dai-hoc");
  assert.ok(b.suggestSlug("a".repeat(100)).length <= 40);
});

const valid = {
  planCode: "basic", cycle: "MONTH", schoolName: "Trường Demo", slug: "demo-school",
  adminAccount: "owner01", adminPassword: "Abcdef123!", confirmPassword: "Abcdef123!",
  contactName: "Nguyễn A", contactEmail: "a@example.com", contactPhone: "0901234567", accepted: true,
};
test("form validation mirrors server rules and reports every problem", () => {
  assert.deepEqual(b.validateBuy(valid), {});
  const errors = b.validateBuy({ ...valid, slug: "admin", adminPassword: "short", confirmPassword: "x", contactEmail: "no", accepted: false, adminAccount: "a b", schoolName: "x", contactName: "", contactPhone: "abc" });
  for (const key of ["slug", "adminPassword", "confirmPassword", "contactEmail", "accepted", "adminAccount", "schoolName", "contactName", "contactPhone"])
    assert.ok(errors[key], key);
  assert.ok(b.validateBuy({ ...valid, slug: "-bad" }).slug);
  assert.ok(b.validateBuy({ ...valid, adminPassword: "Abcdef1234", confirmPassword: "Abcdef1234" }).adminPassword);
});

test("checkout validates contact details without requiring school credentials", () => {
  assert.deepEqual(b.validateCheckout({ planCode: "basic", cycle: "MONTH", contactName: "Người mua", contactEmail: "buyer@example.com", contactPhone: "", accepted: true }), {});
  const errors = b.validateCheckout({ planCode: "", cycle: "WEEK", contactName: "", contactEmail: "bad", contactPhone: "x", accepted: false });
  for (const key of ["planCode", "cycle", "contactName", "contactEmail", "contactPhone", "accepted"]) assert.ok(errors[key]);
  assert.equal(errors.adminPassword, undefined);
  assert.deepEqual(b.validateSchoolSetup(valid), {});
});

test("idempotency keys are unique and match the server pattern", () => {
  globalThis.crypto ??= (await_import_crypto());
  const a = b.newIdempotencyKey(), c = b.newIdempotencyKey();
  assert.notEqual(a, c);
  assert.match(a, /^[A-Za-z0-9._:-]{16,100}$/);
});
import { webcrypto } from "node:crypto";
function await_import_crypto() { return webcrypto; }

test("order status drives the result page", () => {
  const o = (status, fulfilmentStatus) => ({ status, fulfilmentStatus });
  assert.equal(b.resultView(o("PAID", "DONE")), "success");
  for(const domainStatus of ["PENDING","PROCESSING","WAITING","ERROR"]) {
    const waiting = {...o("PAID","DONE"),domainStatus};
    assert.equal(b.resultView(waiting),"provisioning");
    assert.equal(b.isFinalStatus(waiting),false);
  }
  assert.equal(b.resultView({...o("PAID","DONE"),domainStatus:"READY"}),"success");
  assert.equal(b.isFinalStatus({...o("PAID","DONE"),domainStatus:"READY"}),true);
  assert.equal(b.resultView({ ...o("PAID", "NONE"), setupRequired: true }), "setup");
  assert.equal(b.resultView({ ...o("PENDING", "NONE"), setupRequired: true }), "unpaid");
  assert.equal(b.isFinalStatus({ ...o("PAID", "NONE"), setupRequired: true }), true);
  assert.equal(Boolean(b.isFinalStatus({ ...o("PENDING", "NONE"), setupRequired: true })), false);
  assert.equal(b.resultView(o("PAID", "PENDING")), "provisioning");
  assert.equal(b.resultView(o("PAID", "FAILED")), "needs-support");
  assert.equal(b.resultView(o("PENDING", "NONE")), "unpaid");
  assert.equal(b.resultView(o("CANCELLED", "NONE")), "cancelled");
  assert.equal(b.resultView(o("EXPIRED", "NONE")), "expired");
  assert.equal(b.isFinalStatus(o("PAID", "PENDING")), false);
  assert.equal(b.isFinalStatus(o("PENDING", "NONE")), false);
  for (const s of [o("PAID", "DONE"), o("PAID", "FAILED"), o("CANCELLED", "NONE"), o("EXPIRED", "NONE")]) assert.equal(b.isFinalStatus(s), true);
});

test("polling backs off and is bounded", () => {
  assert.equal(b.pollDelay(0), 2000);
  assert.equal(b.pollDelay(1), 3000);
  assert.equal(b.pollDelay(30), 10000);
  let total = 0;
  for (let i = 0; i < b.maxPollAttempts; i++) total += b.pollDelay(i);
  assert.ok(total > 120000 && total < 400000);
});
