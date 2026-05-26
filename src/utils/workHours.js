// Laboral: extras a partir de 10h netas trabajadas
// Sábado:  extras a partir de 5h netas trabajadas
const REGULAR_THRESHOLD_WEEKDAY = 10 * 60;
const REGULAR_THRESHOLD_SATURDAY = 5 * 60;

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

export function calculateWorkMinutes({
  workDate,
  startTime,
  endTime,
  lunchMinutes,
  skippedLunch,
  startTime2,
  endTime2,
  isHoliday = false,
}) {
  const day = workDate ? new Date(`${workDate}T00:00:00`) : null;
  const dayOfWeek = day && !Number.isNaN(day.getTime()) ? day.getDay() : null;
  const isSunday = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;
  const isFestiveDay = isSunday || isHoliday;

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

  const normalizedLunch = Math.max(0, Number(lunchMinutes) || 0);
  const net1 = Math.max(0, (end - start) - normalizedLunch);

  // Segundo turno (sin pausa de comida)
  const start2 = startTime2 ? timeToMinutes(startTime2) : 0;
  const end2 = endTime2 ? timeToMinutes(endTime2) : 0;
  const net2 = end2 > start2 ? end2 - start2 : 0;

  const totalNet = net1 + net2;

  if (isFestiveDay) {
    return {
      regularMinutes: 0,
      extraMinutes: totalNet,
      festiveMinutes: totalNet,
      nonFestiveExtraMinutes: 0,
      totalMinutes: totalNet,
    };
  }

  const threshold = isSaturday ? REGULAR_THRESHOLD_SATURDAY : REGULAR_THRESHOLD_WEEKDAY;
  const regularMinutes = Math.min(totalNet, threshold);
  const nonFestiveExtraMinutes = Math.max(0, totalNet - threshold);

  return {
    regularMinutes,
    extraMinutes: nonFestiveExtraMinutes,
    festiveMinutes: 0,
    nonFestiveExtraMinutes,
    totalMinutes: totalNet,
  };
}
