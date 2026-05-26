const MINUTES_AT_19 = 19 * 60;
const MINUTES_AT_1230 = 12 * 60 + 30;
const DEFAULT_LUNCH_BONUS = 90;

function timeToMinutes(value) {
  if (!value || !value.includes(':')) return 0;
  const [hh, mm] = value.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

export function formatMinutesAsHours(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const wholeHours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;
  return `${wholeHours}h ${restMinutes.toString().padStart(2, '0')}m`;
}

export function calculateWorkMinutes({ workDate, startTime, endTime, lunchMinutes, skippedLunch, isHoliday = false }) {
  const day = workDate ? new Date(`${workDate}T00:00:00`) : null;
  const dayOfWeek = day && !Number.isNaN(day.getTime()) ? day.getDay() : null;
  const isSunday = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;
  const isFestiveDay = isSunday || isHoliday;
  const hadLunch = skippedLunch === undefined ? true : !skippedLunch;

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (end <= start) {
    return {
      regularMinutes: 0,
      extraMinutes: 0,
      festiveMinutes: 0,
      nonFestiveExtraMinutes: 0,
      totalMinutes: 0,
    };
  }

  const duration = end - start;
  const normalizedLunch = Math.max(0, Number(lunchMinutes) || 0);

  const netBaseMinutes = Math.max(0, duration - normalizedLunch);

  const extraAfter19 = Math.max(0, end - MINUTES_AT_19);
  const extraAfterSaturday = isSaturday ? Math.max(0, end - MINUTES_AT_1230) : 0;
  const thresholdExtra = isSaturday ? extraAfterSaturday : extraAfter19;
  const festiveMinutes = isFestiveDay ? netBaseMinutes : 0;
  const extraNoLunch = hadLunch ? 0 : Math.max(0, DEFAULT_LUNCH_BONUS - normalizedLunch);
  const saturdayNoLunchBonus = isSaturday ? 0 : extraNoLunch;
  const saturdayRegularWindow = isSaturday ? Math.max(0, Math.min(end, MINUTES_AT_1230) - start) : 0;
  const saturdayExtraWindow = isSaturday ? Math.max(0, end - Math.max(start, MINUTES_AT_1230)) : 0;
  const saturdayLunchOnExtra = isSaturday ? Math.min(normalizedLunch, saturdayExtraWindow) : 0;
  const saturdayLunchOnRegular = isSaturday ? Math.max(0, normalizedLunch - saturdayLunchOnExtra) : 0;
  const saturdayRegularMinutes = Math.max(0, saturdayRegularWindow - saturdayLunchOnRegular);
  const saturdayExtraMinutes = Math.max(0, saturdayExtraWindow - saturdayLunchOnExtra);

  const nonFestiveExtraMinutes = isFestiveDay
    ? 0
    : isSaturday
      ? Math.max(0, saturdayExtraMinutes + saturdayNoLunchBonus)
      : Math.max(0, thresholdExtra + extraNoLunch);

  const regularMinutes = isFestiveDay
    ? 0
    : isSaturday
      ? saturdayRegularMinutes
      : Math.max(0, netBaseMinutes - thresholdExtra);
  const extraMinutes = Math.max(0, nonFestiveExtraMinutes + festiveMinutes);

  return {
    regularMinutes,
    extraMinutes,
    festiveMinutes,
    nonFestiveExtraMinutes,
    totalMinutes: regularMinutes + extraMinutes,
  };
}
