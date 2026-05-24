import { supabase } from './supabaseClient';

const ALLOWED_ESTADOS = ['supervisar', 'pasado', 'emitido', 'pagada'];

function normalizeEstado(value) {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'cobrado' || normalized === 'cobrada') return 'pagada';
  if (ALLOWED_ESTADOS.includes(normalized)) return normalized;
  return 'supervisar';
}

function isEmailLike(value) {
  return /^\S+@\S+\.\S+$/.test((value || '').trim());
}

function resolveOperarioName(parsedOperario, profileFullName) {
  const fromProfile = (profileFullName || '').trim();
  if (fromProfile) return fromProfile;

  const fromNotes = (parsedOperario || '').trim();
  if (fromNotes && !isEmailLike(fromNotes)) return fromNotes;

  return '';
}

function parseNotes(notes) {
  if (!notes) {
    return { operario: '', operarioUserId: '', descripcion: '', cantidad: '', unidad: 'cantidad' };
  }

  // New format: JSON payload stored in notes.
  if (notes.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(notes);
      return {
        operario: parsed.operario || '',
        operarioUserId: parsed.operarioUserId || '',
        descripcion: parsed.descripcion || '',
        cantidad: parsed.cantidad || '',
        unidad: parsed.unidad || 'cantidad',
      };
    } catch {
      // Fall through to legacy parser.
    }
  }

  // Legacy format: "descripcion | Cantidad: X unidad"
  const legacyMatch = notes.match(/^(.*)\s\|\sCantidad:\s([\d.,]+)\s(.+)$/);
  if (legacyMatch) {
    return {
      operario: '',
      operarioUserId: '',
      descripcion: legacyMatch[1] || '',
      cantidad: legacyMatch[2] || '',
      unidad: legacyMatch[3] || 'cantidad',
    };
  }

  // If no known format, treat the whole note as description.
  return { operario: '', operarioUserId: '', descripcion: notes, cantidad: '', unidad: 'cantidad' };
}

function mapDbJobToUiJob(row, profileNameByUserId = {}) {
  const parsed = parseNotes(row.notes);
  return {
    id: row.id,
    user_id: row.user_id,
    operarioUserId: row.user_id || parsed.operarioUserId,
    estado: normalizeEstado(row.estado),
    cliente: row.title || '',
    operario: resolveOperarioName(parsed.operario, profileNameByUserId[row.user_id]),
    fecha: row.work_date || '',
    descripcion: parsed.descripcion,
    cantidad: parsed.cantidad,
    unidad: parsed.unidad,
    created_at: row.created_at,
  };
}

function buildNotesPayload(jobData) {
  return JSON.stringify({
    operario: jobData.operario || '',
    operarioUserId: jobData.operarioUserId || '',
    descripcion: jobData.descripcion || '',
    cantidad: jobData.cantidad || '',
    unidad: jobData.unidad || 'cantidad',
  });
}

export async function loadJobsFromSupabase(userId, isAdmin) {
  try {
    let query = supabase.from('jobs').select('*');

    // Si no es admin, solo sus trabajos
    if (!isAdmin) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading jobs:', error);
      return [];
    }

    const rows = data || [];
    const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
    const profileNameByUserId = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error loading profiles for jobs:', profilesError);
      } else {
        (profiles || []).forEach((item) => {
          profileNameByUserId[item.id] = item.full_name || '';
        });
      }
    }

    return rows.map((row) => mapDbJobToUiJob(row, profileNameByUserId));
  } catch (err) {
    console.error('Unexpected error loading jobs:', err);
    return [];
  }
}

export async function saveJobToSupabase(jobData, userId, isAdmin = false) {
  try {
    const assignedUserId = isAdmin && jobData.operarioUserId ? jobData.operarioUserId : userId;
    const nextStatus = normalizeEstado(jobData.estado);

    if (jobData.id) {
      const updatePayload = {
        user_id: assignedUserId,
        title: jobData.cliente,
        work_date: jobData.fecha,
        notes: buildNotesPayload(jobData)
      };

      if (isAdmin && ALLOWED_ESTADOS.includes(nextStatus)) {
        updatePayload.estado = nextStatus;
      }

      // Actualizar trabajo existente
      const { data, error } = await supabase
        .from('jobs')
        .update(updatePayload)
        .eq('id', jobData.id)
        .eq('estado', 'supervisar')
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('JOB_LOCKED_BY_STATUS');
      }
      return data?.[0] ? mapDbJobToUiJob(data[0]) : null;
    } else {
      // Crear nuevo trabajo
      const { data, error } = await supabase
        .from('jobs')
        .insert([{
          user_id: assignedUserId,
          estado: 'supervisar',
          title: jobData.cliente,
          work_date: jobData.fecha,
          notes: buildNotesPayload(jobData)
        }])
        .select();

      if (error) throw error;
      return data?.[0] ? mapDbJobToUiJob(data[0]) : null;
    }
  } catch (err) {
    console.error('Error saving job:', err);
    throw err;
  }
}

export async function deleteJobFromSupabase(jobId) {
  try {
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (error) throw error;
  } catch (err) {
    console.error('Error deleting job:', err);
    throw err;
  }
}
