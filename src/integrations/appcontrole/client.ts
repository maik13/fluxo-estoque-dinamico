import { createClient } from "@supabase/supabase-js";

const APP_CONTROLE_URL = "https://vwjtlndymnbzanvpzkda.supabase.co";
const APP_CONTROLE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3anRsbmR5bW5iemFudnB6a2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjI4NDksImV4cCI6MjA4MTM5ODg0OX0.Ikj4J4uehHv6TTErUOxkikSo2nvObjbTRpR7z4Q-E2g";

export const appControleSupabase = createClient(
  APP_CONTROLE_URL,
  APP_CONTROLE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "fluxo-appcontrole-session-v1",
    },
  },
);

export const APP_CONTROLE_PROJECT_URL = APP_CONTROLE_URL;
