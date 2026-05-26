-- Migración: añadir soporte de doble turno a work_logs
-- Ejecutar en el SQL Editor de Supabase

ALTER TABLE work_logs
  ADD COLUMN IF NOT EXISTS start_time_2 TIME,
  ADD COLUMN IF NOT EXISTS end_time_2 TIME;
