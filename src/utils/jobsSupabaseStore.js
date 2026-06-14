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
    descripcion: capitalizeFirstLetter(parsed.descripcion),
    cantidad: parsed.cantidad,
    unidad: parsed.unidad,
    pdfFilename: row.pdf_filename || '',
    pdfStoragePath: row.pdf_storage_path || '',
    pdfGeneratedAt: row.pdf_generated_at || null,
    pdfPhotoCount: row.pdf_photo_count ?? 0,
    pdfSigned: Boolean(row.pdf_signed),
    created_at: row.created_at,
  };
}

function safePathSegment(value, fallback = 'valor') {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function capitalizeFirstLetter(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildNotesPayload(jobData) {
  return JSON.stringify({
    operario: jobData.operario || '',
    operarioUserId: jobData.operarioUserId || '',
    descripcion: capitalizeFirstLetter(jobData.descripcion),
    cantidad: jobData.cantidad || '',
    unidad: jobData.unidad || 'cantidad',
  });
}

export async function loadJobsFromSupabase(userId, isAdmin, { page = 1, pageSize = 20 } = {}) {
  try {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Number(pageSize) || 20);
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    let query = supabase.from('jobs').select('*', { count: 'exact' });

    // Si no es admin, solo sus trabajos
    if (!isAdmin) {
      query = query.eq('user_id', userId);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error loading jobs:', error);
      return {
        jobs: [],
        totalCount: 0,
        page: safePage,
        pageSize: safePageSize,
      };
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

    return {
      jobs: rows.map((row) => mapDbJobToUiJob(row, profileNameByUserId)),
      totalCount: Number(count) || 0,
      page: safePage,
      pageSize: safePageSize,
    };
  } catch (err) {
    console.error('Unexpected error loading jobs:', err);
    return {
      jobs: [],
      totalCount: 0,
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.max(1, Number(pageSize) || 20),
    };
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

export async function uploadJobPdfAndAttach({
  jobId,
  ownerUserId,
  uploaderUserId,
  fileName,
  pdfBlob,
  signed = false,
  photoCount = 0,
}) {
  const safeJobId = String(jobId || '').trim();
  const safeOwnerId = String(ownerUserId || '').trim();
  const safeUploaderId = String(uploaderUserId || '').trim();

  if (!safeJobId) throw new Error('Missing job ID for PDF upload');
  if (!safeOwnerId) throw new Error('Missing owner user ID for PDF upload');
  if (!safeUploaderId) throw new Error('Missing uploader user ID for PDF upload');
  if (!pdfBlob) throw new Error('Missing PDF blob for upload');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const normalizedFile = safePathSegment(fileName || 'trabajo-pdf', 'trabajo-pdf');
  const storagePath = `${safeUploaderId}/${safeJobId}/${timestamp}-${normalizedFile}.pdf`;

  const { error: uploadError } = await supabase
    .storage
    .from('job-pdfs')
    .upload(storagePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message || 'unknown error'}`);
  }

  const { data, error: updateError } = await supabase
    .from('jobs')
    .update({
      pdf_filename: fileName || 'trabajo.pdf',
      pdf_storage_path: storagePath,
      pdf_generated_at: new Date().toISOString(),
      pdf_signed: Boolean(signed),
      pdf_photo_count: Math.max(0, Number(photoCount) || 0),
    })
    .eq('id', safeJobId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Jobs update failed: ${updateError.message || 'unknown error'}`);
  }
  return data;
}

export async function getJobPdfSignedUrl(storagePath, expiresInSeconds = 300) {
  const safePath = String(storagePath || '').trim();
  if (!safePath) throw new Error('PDF path is empty');

  const { data, error } = await supabase
    .storage
    .from('job-pdfs')
    .createSignedUrl(safePath, Math.max(60, Number(expiresInSeconds) || 300));

  if (error) {
    throw new Error(`Cannot create PDF URL: ${error.message || 'unknown error'}`);
  }

  if (!data?.signedUrl) {
    throw new Error('Cannot create PDF URL: signed URL is empty');
  }

  return data.signedUrl;
}
