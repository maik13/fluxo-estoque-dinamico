# AGENTS.md

- Keep Página54 origin detection and its visual marker centralized in `src/components/financeiro/IndicadorPagina54.tsx`; why: one rule set so imported and manual entries are never confused.
- The RC "Materiais solicitados" view is read-only: merge rules live in `src/components/gestao-estoque/materiaisSolicitadosRc.ts` (pure, tested) and source documents only fill empty fields of matching RC items, never add unrelated request items; why: request material can include items served by stock or other RCs, and opening a view must never write data.
- Planejamento 2.0 is the App Controle original module ported verbatim into `src/planejamento-v2-original/` (only import paths rewritten; supabase points to the App Controle client; runs in its own MemoryRouter); why: must behave identically to the source, never reimplement a reduced version.
