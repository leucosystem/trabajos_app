import { useEffect, useMemo, useState } from "react";
import "./HoursView.css";
import { calculateWorkMinutes, formatMinutesAsHours } from "../utils/workHours";
import {
  loadHolidaysMonth,
  loadWorkLogsForDate,
  loadWorkLogsMonth,
  recalculateWorkLogsForDate,
  setHolidayDate,
  unsetHolidayDate,
  upsertWorkLog,
} from "../utils/workLogsSupabaseStore";

function friendlyHoursError(error, fallbackMessage) {
  const rawMessage = String(error?.message || "");
  const normalized = rawMessage.toLowerCase();
  const details = String(error?.details || "").toLowerCase();

  const missingTable =
    error?.code === "42P01" ||
    normalized.includes('relation "work_logs" does not exist') ||
    details.includes('relation "work_logs" does not exist');

  if (missingTable) {
    return "Falta configurar Horas en Supabase. Ejecuta scripts/supabase_work_logs_setup.sql";
  }

  if (error?.code === "42501" || normalized.includes("permission denied")) {
    return "No tienes permisos para acceder a Horas. Revisa las políticas RLS.";
  }

  if (rawMessage) {
    return `${fallbackMessage}: ${rawMessage}`;
  }

  return fallbackMessage;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(date) {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(date);
}

function dayNameLabel(index) {
  const names = ["L", "M", "X", "J", "V", "S", "D"];
  return names[index] || "";
}

function buildCalendarMatrix(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const firstDayMondayIndex = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const cells = [];
  for (let i = 0; i < firstDayMondayIndex; i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function toTimeInput(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

export default function HoursView({
  userId,
  isAdmin,
  assignableUsers,
  isLoadingAssignableUsers,
  onNotify,
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [targetUserId, setTargetUserId] = useState(userId || "");
  const [selectedDate, setSelectedDate] = useState(toIsoDate(new Date()));
  const [logs, setLogs] = useState([]);
  const [holidays, setHolidays] = useState(new Set());
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingHolidayDate, setSavingHolidayDate] = useState(null);
  const [showAdminDayDetail, setShowAdminDayDetail] = useState(false);
  const [loadingAdminDayDetail, setLoadingAdminDayDetail] = useState(false);
  const [adminDayRows, setAdminDayRows] = useState([]);
  const [form, setForm] = useState({
    startTime: "07:30",
    endTime: "",
    lunchMinutes: 90,
    skippedLunch: false,
    secondShift: false,
    startTime2: "",
    endTime2: "",
    notes: "",
  });

  useEffect(() => {
    if (!isAdmin) {
      setTargetUserId(userId);
      return;
    }

    if (targetUserId) return;

    const ownUser = assignableUsers.find((item) => item.id === userId);
    setTargetUserId(ownUser?.id || assignableUsers[0]?.id || userId || "");
  }, [isAdmin, userId, targetUserId, assignableUsers]);

  useEffect(() => {
    if (!targetUserId) return;

    let alive = true;
    async function loadLogs() {
      setLoadingLogs(true);
      try {
        const data = await loadWorkLogsMonth({
          viewerUserId: userId,
          targetUserId,
          isAdmin,
          monthDate: currentMonth,
        });
        const holidaysData = await loadHolidaysMonth(currentMonth);
        if (alive) setLogs(data);
        if (alive) {
          setHolidays(new Set(holidaysData.map((item) => item.holiday_date)));
        }
      } catch (error) {
        console.error("Error loading work logs:", error);
        if (alive) {
          onNotify?.(friendlyHoursError(error, "No se pudieron cargar las horas"), "error");
        }
      } finally {
        if (alive) setLoadingLogs(false);
      }
    }

    loadLogs();
    return () => {
      alive = false;
    };
  }, [currentMonth, targetUserId, userId, isAdmin, onNotify]);

  useEffect(() => {
    const today = new Date();
    const isCurrentMonthView =
      currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() === today.getMonth();
    if (!isCurrentMonthView) return;

    const todayIso = toIsoDate(today);
    if (selectedDate !== todayIso) {
      setSelectedDate(todayIso);
    }
  }, [currentMonth]);

  const logsByDate = useMemo(() => {
    const map = new Map();
    logs.forEach((row) => map.set(row.work_date, row));
    return map;
  }, [logs]);

  useEffect(() => {
    const existing = logsByDate.get(selectedDate);
    if (existing) {
      setForm({
        startTime: toTimeInput(existing.start_time),
        endTime: toTimeInput(existing.end_time),
        lunchMinutes: existing.lunch_minutes ?? 90,
        skippedLunch: Boolean(existing.skipped_lunch),
        secondShift: Boolean(existing.start_time_2),
        startTime2: toTimeInput(existing.start_time_2),
        endTime2: toTimeInput(existing.end_time_2),
        notes: existing.notes || "",
      });
      return;
    }

    setForm({
      startTime: "07:30",
      endTime: "",
      lunchMinutes: 90,
      skippedLunch: false,
      secondShift: false,
      startTime2: "",
      endTime2: "",
      notes: "",
    });
  }, [selectedDate, logsByDate]);

  const calculated = useMemo(
    () =>
      calculateWorkMinutes({
        workDate: selectedDate,
        startTime: form.startTime,
        endTime: form.endTime,
        lunchMinutes: form.lunchMinutes,
        skippedLunch: form.skippedLunch,
        startTime2: form.secondShift ? form.startTime2 : undefined,
        endTime2: form.secondShift ? form.endTime2 : undefined,
        isHoliday: holidays.has(selectedDate),
      }),
    [form, selectedDate, holidays]
  );

  const selectedDateObj = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate]);
  const selectedIsSunday = !Number.isNaN(selectedDateObj.getTime()) && selectedDateObj.getDay() === 0;
  const selectedIsHoliday = holidays.has(selectedDate);
  const selectedIsFestiveDay = selectedIsSunday || selectedIsHoliday;

  const calendarCells = useMemo(() => buildCalendarMatrix(currentMonth), [currentMonth]);

  const monthTotals = useMemo(() => {
    return logs.reduce(
      (acc, row) => {
        const metrics = calculateWorkMinutes({
          workDate: row.work_date,
          startTime: toTimeInput(row.start_time),
          endTime: toTimeInput(row.end_time),
          lunchMinutes: row.lunch_minutes,
          skippedLunch: Boolean(row.skipped_lunch),
          startTime2: toTimeInput(row.start_time_2),
          endTime2: toTimeInput(row.end_time_2),
          isHoliday: holidays.has(row.work_date),
        });

        return {
          extraMinutes: acc.extraMinutes + metrics.nonFestiveExtraMinutes,
          festiveMinutes: acc.festiveMinutes + metrics.festiveMinutes,
        };
      },
      { extraMinutes: 0, festiveMinutes: 0 }
    );
  }, [logs, holidays]);

  async function handleSave(event) {
    event.preventDefault();
    if (!targetUserId) return;

    const result = calculateWorkMinutes({
      workDate: selectedDate,
      startTime: form.startTime,
      endTime: form.endTime,
      lunchMinutes: form.lunchMinutes,
      skippedLunch: form.skippedLunch,
      startTime2: form.secondShift ? form.startTime2 : undefined,
      endTime2: form.secondShift ? form.endTime2 : undefined,
      isHoliday: holidays.has(selectedDate),
    });
    if (result.totalMinutes <= 0) {
      onNotify?.("Revisa inicio/fin: la jornada debe ser válida", "error");
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertWorkLog({
        viewerUserId: userId,
        targetUserId,
        isAdmin,
        payload: {
          workDate: selectedDate,
          startTime: form.startTime,
          endTime: form.endTime,
          lunchMinutes: Number(form.lunchMinutes) || 0,
          skippedLunch: form.skippedLunch,
          startTime2: form.secondShift ? form.startTime2 : null,
          endTime2: form.secondShift ? form.endTime2 : null,
          regularMinutes: result.regularMinutes,
          extraMinutes: result.extraMinutes,
          notes: form.notes,
        },
      });

      setLogs((prev) => {
        const next = prev.filter((row) => row.work_date !== saved.work_date);
        return [...next, saved].sort((a, b) => a.work_date.localeCompare(b.work_date));
      });
      onNotify?.("Jornada guardada", "success");
    } catch (error) {
      console.error("Error saving work log:", error);
      onNotify?.(friendlyHoursError(error, "No se pudo guardar la jornada"), "error");
    } finally {
      setSaving(false);
    }
  }

  function shiftMonth(delta) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function minutesToShortHours(minutes) {
    return `${(Math.max(0, Number(minutes) || 0) / 60).toFixed(1)}h`;
  }

  function deriveDayMetrics(dayLog, isoDate) {
    if (!dayLog) {
      return {
        totalMinutes: 0,
        extraMinutes: 0,
        festiveMinutes: 0,
      };
    }

    return calculateWorkMinutes({
      workDate: isoDate,
      startTime: toTimeInput(dayLog.start_time),
      endTime: toTimeInput(dayLog.end_time),
      lunchMinutes: dayLog.lunch_minutes,
      skippedLunch: Boolean(dayLog.skipped_lunch),
      startTime2: toTimeInput(dayLog.start_time_2),
      endTime2: toTimeInput(dayLog.end_time_2),
      isHoliday: holidays.has(isoDate),
    });
  }

  async function handleToggleHoliday(isoDate, isCurrentlyHoliday) {
    if (!isAdmin || savingHolidayDate) return;

    setSavingHolidayDate(isoDate);
    try {
      if (isCurrentlyHoliday) {
        await unsetHolidayDate(isoDate);
      } else {
        await setHolidayDate(isoDate, "Festivo");
      }

      const nextHolidayValue = !isCurrentlyHoliday;
      await recalculateWorkLogsForDate(isoDate, nextHolidayValue);

      setHolidays((prev) => {
        const next = new Set(prev);
        if (nextHolidayValue) next.add(isoDate);
        else next.delete(isoDate);
        return next;
      });

      const data = await loadWorkLogsMonth({
        viewerUserId: userId,
        targetUserId,
        isAdmin,
        monthDate: currentMonth,
      });
      setLogs(data || []);

      onNotify?.(
        nextHolidayValue
          ? "Festivo marcado y jornadas recalculadas"
          : "Festivo quitado y jornadas recalculadas",
        "success"
      );
    } catch (error) {
      console.error("Error toggling holiday:", error);
      onNotify?.(friendlyHoursError(error, "No se pudo actualizar el festivo"), "error");
    } finally {
      setSavingHolidayDate(null);
    }
  }

  async function openAdminDayDetail() {
    if (!isAdmin) return;

    setLoadingAdminDayDetail(true);
    setShowAdminDayDetail(true);
    try {
      const rows = await loadWorkLogsForDate(selectedDate);
      setAdminDayRows(rows);
    } catch (error) {
      console.error("Error loading admin day detail:", error);
      onNotify?.(friendlyHoursError(error, "No se pudo cargar el detalle del día"), "error");
      setShowAdminDayDetail(false);
    } finally {
      setLoadingAdminDayDetail(false);
    }
  }

  const adminDayTotals = useMemo(() => {
    return adminDayRows.reduce(
      (acc, row) => {
        const metrics = calculateWorkMinutes({
          workDate: row.work_date,
          startTime: toTimeInput(row.start_time),
          endTime: toTimeInput(row.end_time),
          lunchMinutes: row.lunch_minutes,
          skippedLunch: Boolean(row.skipped_lunch),
          startTime2: toTimeInput(row.start_time_2),
          endTime2: toTimeInput(row.end_time_2),
          isHoliday: selectedIsHoliday,
        });

        return {
          regularMinutes: acc.regularMinutes + metrics.regularMinutes,
          extraMinutes: acc.extraMinutes + metrics.nonFestiveExtraMinutes,
          festiveMinutes: acc.festiveMinutes + metrics.festiveMinutes,
          totalMinutes: acc.totalMinutes + metrics.totalMinutes,
        };
      },
      { regularMinutes: 0, extraMinutes: 0, festiveMinutes: 0, totalMinutes: 0 }
    );
  }, [adminDayRows, selectedIsHoliday]);

  return (
    <section className="hours-wrap">
      <div className="hours-head">
        <div className="hours-month-nav">
          <button type="button" className="secondary-btn" onClick={() => shiftMonth(-1)}>
            Anterior
          </button>
          <p>{monthLabel(currentMonth)}</p>
          <button type="button" className="secondary-btn" onClick={() => shiftMonth(1)}>
            Siguiente
          </button>
        </div>
        <div className="hours-month-totals" aria-live="polite">
          <p>
            Extras <strong>{formatMinutesAsHours(monthTotals.extraMinutes)}</strong>
          </p>
          <p>
            Festivas <strong>{formatMinutesAsHours(monthTotals.festiveMinutes)}</strong>
          </p>
        </div>
      </div>

      {isAdmin && (
        <label className="form-field" htmlFor="hours-user-select">
          Usuario
          <select
            id="hours-user-select"
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
            disabled={isLoadingAssignableUsers}
          >
            {assignableUsers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="hours-layout">
        <div className="hours-calendar-card">
          <div className="hours-weekdays">
            {Array.from({ length: 7 }).map((_, index) => (
              <span key={dayNameLabel(index)}>{dayNameLabel(index)}</span>
            ))}
          </div>

          <div className="hours-calendar-grid" aria-busy={loadingLogs}>
            {calendarCells.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="day-cell empty" aria-hidden="true" />;
              }

              const iso = toIsoDate(day);
              const dayLog = logsByDate.get(iso);
              const dayMetrics = deriveDayMetrics(dayLog, iso);
              const isSelected = selectedDate === iso;
              const isToday = iso === toIsoDate(new Date());
              const isSunday = day.getDay() === 0;
              const isHoliday = holidays.has(iso);
              const isFestiveDay = isHoliday || isSunday;
              const calendarExtraMinutes = isFestiveDay ? dayMetrics.festiveMinutes : dayMetrics.extraMinutes;

              return (
                <button
                  key={iso}
                  type="button"
                  className={`day-cell ${isSelected ? "selected" : ""} ${isToday ? "today" : ""} ${dayLog ? "has-log" : ""} ${isFestiveDay ? "holiday" : ""}`}
                  onClick={() => setSelectedDate(iso)}
                >
                  <span className="day-top">
                    <span className="day-number">{day.getDate()}</span>
                    {isFestiveDay && <span className="day-festive-mark">Festivo</span>}
                  </span>
                  {dayLog && (
                    <span className="day-badges">
                      {calendarExtraMinutes > 0 && (
                        <span className={`day-badge ${isFestiveDay ? "festive" : "extra"}`}>
                          {isFestiveDay ? "F" : "E"} {minutesToShortHours(calendarExtraMinutes)}
                        </span>
                      )}
                    </span>
                  )}

                </button>
              );
            })}
          </div>
        </div>

        <form className="hours-form-card" onSubmit={handleSave}>
          <div className="hours-form-head">
            <h3>Jornada del {selectedDate.split("-").reverse().join("/")}</h3>
            {selectedIsFestiveDay && (
              <span className="selected-festive-pill">Festivo</span>
            )}
          </div>

          {isAdmin && (
            <div className="admin-day-actions">
              <div className="admin-day-actions-controls">
                {!selectedIsSunday && (
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={savingHolidayDate === selectedDate}
                    onClick={() => handleToggleHoliday(selectedDate, selectedIsHoliday)}
                  >
                    {selectedIsHoliday ? "Quitar festivo" : "Marcar festivo"}
                  </button>
                )}

                <button
                  type="button"
                  className="secondary-btn admin-loupe-btn"
                  onClick={openAdminDayDetail}
                  title="Ver detalle de obreros del día"
                >
                  Ver detalle del día
                </button>
              </div>
            </div>
          )}

          <div className="hours-row two-cols">
            <label className="hours-time-field" htmlFor="start-time">
              <span>Inicio</span>
              <input
                id="start-time"
                type="time"
                value={form.startTime}
                onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
                required
              />
            </label>

            <label className="hours-time-field" htmlFor="end-time">
              <span>Fin</span>
              <input
                id="end-time"
                type="time"
                value={form.endTime}
                onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
                required
              />
            </label>
          </div>

          <div className="hours-row two-cols">
            <label className="hours-check" htmlFor="skipped-lunch">
              <input
                id="skipped-lunch"
                type="checkbox"
                checked={form.skippedLunch}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    skippedLunch: event.target.checked,
                    lunchMinutes: event.target.checked ? 0 : 90,
                  }))
                }
              />
              No paré a comer
            </label>

            {form.skippedLunch ? (
              <label className="form-field" htmlFor="lunch-minutes">
                Parada comer (min)
                <input
                  id="lunch-minutes"
                  type="number"
                  min="0"
                  max="90"
                  value={form.lunchMinutes}
                  onChange={(event) => setForm((prev) => ({ ...prev, lunchMinutes: event.target.value }))}
                />
              </label>
            ) : null}
          </div>

          <div className="hours-row">
            <label className="hours-check" htmlFor="second-shift">
              <input
                id="second-shift"
                type="checkbox"
                checked={form.secondShift}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    secondShift: event.target.checked,
                    startTime2: "",
                    endTime2: "",
                  }))
                }
              />
              Segundo turno
            </label>
          </div>

          {form.secondShift && (
            <div className="hours-row two-cols">
              <label className="hours-time-field" htmlFor="start-time-2">
                <span>Inicio 2</span>
                <input
                  id="start-time-2"
                  type="time"
                  value={form.startTime2}
                  onChange={(event) => setForm((prev) => ({ ...prev, startTime2: event.target.value }))}
                />
              </label>
              <label className="hours-time-field" htmlFor="end-time-2">
                <span>Fin 2</span>
                <input
                  id="end-time-2"
                  type="time"
                  value={form.endTime2}
                  onChange={(event) => setForm((prev) => ({ ...prev, endTime2: event.target.value }))}
                />
              </label>
            </div>
          )}

          <label className="form-field" htmlFor="hours-notes">
            Notas (opcional)
            <textarea
              id="hours-notes"
              rows="3"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Observaciones del día"
            />
          </label>

          <div className="hours-summary" role="status" aria-live="polite">
            <p>Extras: <strong>{formatMinutesAsHours(calculated.nonFestiveExtraMinutes)}</strong></p>
            <p>Festivas: <strong>{formatMinutesAsHours(calculated.festiveMinutes)}</strong></p>
            <p>Total: <strong>{formatMinutesAsHours(calculated.totalMinutes)}</strong></p>
          </div>

          <button type="submit" className="primary-btn" disabled={saving || !targetUserId}>
            {saving ? "Guardando..." : "Guardar jornada"}
          </button>
        </form>
      </div>

      {showAdminDayDetail && (
        <div className="hours-modal-backdrop" role="presentation" onClick={() => setShowAdminDayDetail(false)}>
          <section
            className="hours-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Detalle diario de horas"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="hours-modal-head">
              <h4>Detalle del día {selectedDate.split("-").reverse().join("/")}</h4>
              <button type="button" className="secondary-btn" onClick={() => setShowAdminDayDetail(false)}>
                Cerrar
              </button>
            </header>

            {loadingAdminDayDetail ? (
              <p className="hours-modal-loading">Cargando detalle...</p>
            ) : adminDayRows.length === 0 ? (
              <p className="hours-modal-loading">No hay jornadas guardadas para ese día.</p>
            ) : (
              <>
                <div className="hours-modal-list">
                  {adminDayRows.map((row) => {
                    const metrics = calculateWorkMinutes({
                      workDate: row.work_date,
                      startTime: toTimeInput(row.start_time),
                      endTime: toTimeInput(row.end_time),
                      lunchMinutes: row.lunch_minutes,
                      skippedLunch: Boolean(row.skipped_lunch),
                      startTime2: toTimeInput(row.start_time_2),
                      endTime2: toTimeInput(row.end_time_2),
                      isHoliday: selectedIsHoliday,
                    });

                    return (
                      <article key={row.id} className="hours-modal-row">
                        <p className="worker-name">{row.worker_name || "Sin nombre"}</p>
                        <p className="worker-meta">
                          {toTimeInput(row.start_time)} - {toTimeInput(row.end_time)} | Comida: {row.skipped_lunch ? "No" : `${row.lunch_minutes} min`}
                        </p>
                        {row.start_time_2 && (
                          <p className="worker-meta">
                            2º turno: {toTimeInput(row.start_time_2)} - {toTimeInput(row.end_time_2)}
                          </p>
                        )}
                        <p className="worker-meta">
                          N: {minutesToShortHours(metrics.regularMinutes)} | E: {minutesToShortHours(metrics.nonFestiveExtraMinutes)} | F: {minutesToShortHours(metrics.festiveMinutes)}
                        </p>
                      </article>
                    );
                  })}
                </div>

                <footer className="hours-modal-total">
                  <p>Normales: <strong>{formatMinutesAsHours(adminDayTotals.regularMinutes)}</strong></p>
                  <p>Extras: <strong>{formatMinutesAsHours(adminDayTotals.extraMinutes)}</strong></p>
                  <p>Festivas: <strong>{formatMinutesAsHours(adminDayTotals.festiveMinutes)}</strong></p>
                  <p>Total: <strong>{formatMinutesAsHours(adminDayTotals.totalMinutes)}</strong></p>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
