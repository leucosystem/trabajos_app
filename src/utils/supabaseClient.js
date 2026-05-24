import { createClient } from '@supabase/supabase-js';

function normalizeEnvValue(value) {
	if (typeof value !== 'string') return '';
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

function normalizeSupabaseUrl(value) {
	const raw = normalizeEnvValue(value);
	if (!raw) return '';
	const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
	try {
		return new URL(withProtocol).toString().replace(/\/$/, '');
	} catch {
		return '';
	}
}

const SUPABASE_URL = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_ANON_KEY = normalizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	throw new Error(
		'Config de Supabase invalida. Revisa VITE_SUPABASE_URL (con dominio valido) y VITE_SUPABASE_ANON_KEY en tu entorno.'
	);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
