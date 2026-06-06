import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://pvmsfzlwepoldjgolavp.supabase.co";

const supabaseKey =
  "PASTE_YOUR_ANON_PUBLIC_KEY";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
