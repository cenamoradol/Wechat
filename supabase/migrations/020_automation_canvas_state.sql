-- Fase 8: persistir posiciones del canvas N8N-style.
-- Las posiciones de los nodos en el editor visual son por-step (key
-- interna del canvas) + x/y. Sin esto, recargar el editor re-calcula
-- el layout determinístico y se pierde cualquier drag del usuario.

alter table public.automations
  add column if not exists canvas_positions jsonb default '{}'::jsonb;

comment on column public.automations.canvas_positions is
  'Map of step key → {x, y} from the visual canvas. Optional; deterministic layout when missing.';
