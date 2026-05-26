import { supabase } from './supabaseClient';
import { calculateWorkMinutes } from './workHours';

function monthRange(monthDate) {
  const base = new Date(monthDate);
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const toIso = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return { start: toIso(start), end: toIso(end) };
}

function toTimeInput(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

export async function loadWorkLogsMonth({ viewerUserId, targetUserId, isAdmin, monthDate }) {
  const assignedUserId = isAdmin && targetUserId ? targetUserId : viewerUserId;
  const { start, end } = monthRange(monthDate);

  const { data, error } = await supabase
    .from('work_logs')
    .select('*')
    .eq('user_id', assignedUserId)
    .gte('work_date', start)
    .lte('work_date', end)
    .order('work_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function upsertWorkLog({ viewerUserId, targetUserId, isAdmin, payload }) {
  const assignedUserId = isAdmin && targetUserId ? targetUserId : viewerUserId;

  const row = {
    user_id: assignedUserId,
    work_date: payload.workDate,
    start_time: payload.startTime,
    end_time: payload.endTime,
    lunch_minutes: payload.lunchMinutes,
    skipped_lunch: payload.skippedLunch,
    start_time_2: payload.startTime2 || null,
    end_time_2: payload.endTime2 || null,
    regular_minutes: payload.regularMinutes,
    extra_minutes: payload.extraMinutes,
    notes: payload.notes || null,
  };

  const { data, error } = await supabase
    .from('work_logs')
    .upsert(row, { onConflict: 'user_id,work_date' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function loadHolidaysMonth(monthDate) {
  const { start, end } = monthRange(monthDate);

  const { data, error } = await supabase
    .from('holidays')
    .select('holiday_date, label')
    .gte('holiday_date', start)
    .lte('holiday_date', end)
    .order('holiday_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function setHolidayDate(isoDate, label = null) {
  const { error } = await supabase
    .from('holidays')
    .upsert({ holiday_date: isoDate, label }, { onConflict: 'holiday_date' });

  if (error) throw error;
}

export async function unsetHolidayDate(isoDate) {
  const { error } = await supabase
    .from('holidays')
    .delete()
    .eq('holiday_date', isoDate);

  if (error) throw error;
}

export async function recalculateWorkLogsForDate(isoDate, isHoliday) {
  const { data, error } = await supabase
    .from('work_logs')
    .select('id, work_date, start_time, end_time, lunch_minutes, skipped_lunch, start_time_2, end_time_2')
    .eq('work_date', isoDate);

  if (error) throw error;

  const rows = data || [];
  if (rows.length === 0) return;

  await Promise.all(
    rows.map(async (row) => {
      const calc = calculateWorkMinutes({
        workDate: row.work_date,
        startTime: toTimeInput(row.start_time),
        endTime: toTimeInput(row.end_time),
        lunchMinutes: row.lunch_minutes,
        skippedLunch: row.skipped_lunch,
        startTime2: toTimeInput(row.start_time_2),
        endTime2: toTimeInput(row.end_time_2),
        isHoliday,
      });

      const { error: updateError } = await supabase
        .from('work_logs')
        .update({
          regular_minutes: calc.regularMinutes,
          extra_minutes: calc.extraMinutes,
        })
        .eq('id', row.id);

      if (updateError) throw updateError;
    })
  );
}

export async function loadWorkLogsForDate(isoDate) {
  const { data, error } = await supabase
    .from('work_logs')
    .select('id, user_id, work_date, start_time, end_time, lunch_minutes, skipped_lunch, start_time_2, end_time_2, regular_minutes, extra_minutes, notes')
    .eq('work_date', isoDate)
    .order('user_id', { ascending: true });

  if (error) throw error;

  const rows = data || [];
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const nameById = {};

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (profilesError) throw profilesError;
    (profiles || []).forEach((item) => {
      nameById[item.id] = item.full_name || '';
    });
  }

  return rows.map((row) => ({
    ...row,
    worker_name: nameById[row.user_id] || row.user_id,
  }));
}
