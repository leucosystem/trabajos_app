import test from "node:test";
import assert from "node:assert/strict";
import { calculateWorkMinutes } from "./workHours.js";

const H = 60;

function calc(workDate, startTime, endTime, lunchMinutes, extra = {}) {
  const r = calculateWorkMinutes({ workDate, startTime, endTime, lunchMinutes, ...extra });
  return [r.regularMinutes, r.nonFestiveExtraMinutes, r.festiveMinutes];
}

// 2026-10-05 lunes, 2026-10-10 sábado, 2026-10-11 domingo
test("lunes 10 h netas sin comida", () => {
  assert.deepEqual(calc("2026-10-05", "07:30", "17:30", 0), [10 * H, 0, 0]);
});

test("lunes con comida de 90 min llega justo a 10 h", () => {
  assert.deepEqual(calc("2026-10-05", "07:30", "19:00", 90), [10 * H, 0, 0]);
});

test("lunes con 1 h extra", () => {
  assert.deepEqual(calc("2026-10-05", "07:30", "20:00", 90), [10 * H, 1 * H, 0]);
});

test("lunes con segundo turno", () => {
  const r = calc("2026-10-05", "07:30", "13:30", 0, { startTime2: "16:00", endTime2: "20:00" });
  assert.deepEqual(r, [10 * H, 0, 0]);
});

test("sábado: 5 h normales y el resto extra", () => {
  assert.deepEqual(calc("2026-10-10", "07:30", "14:00", 30), [5 * H, 1 * H, 0]);
});

test("domingo todo festivo", () => {
  assert.deepEqual(calc("2026-10-11", "08:00", "12:00", 0), [0, 0, 4 * H]);
});

test("festivo entre semana todo festivo", () => {
  assert.deepEqual(calc("2026-10-05", "08:00", "16:00", 60, { isHoliday: true }), [0, 0, 7 * H]);
});

test("fin menor o igual que inicio da 0", () => {
  assert.deepEqual(calc("2026-10-05", "10:00", "10:00", 0), [0, 0, 0]);
  assert.deepEqual(calc("2026-10-05", "10:00", "09:00", 0), [0, 0, 0]);
});

test("horas vacías dan 0", () => {
  assert.deepEqual(calc("2026-10-05", "", "", 90), [0, 0, 0]);
});
