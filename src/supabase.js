import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://pvmsfzlwepoldjgolavp.supabase.co";

const supabaseKey =
  "sb_publishable_grq7lWV9pgtLoyzR3TzorA_zk30TBAd";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
