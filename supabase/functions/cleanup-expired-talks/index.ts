import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[Cleanup] Starting cleanup of expired talks...");

    // 1. Recupera tutti i messaggi scaduti con file allegati
    const { data: expiredTalks, error: fetchError } = await supabase
      .from("company_talks")
      .select("id, file_url")
      .lt("expires_at", new Date().toISOString())
      .not("file_url", "is", null);

    if (fetchError) {
      console.error("[Cleanup] Error fetching expired talks:", fetchError);
      throw fetchError;
    }

    console.log(`[Cleanup] Found ${expiredTalks?.length || 0} expired talks with files`);

    // 2. Elimina i file dallo storage
    let deletedFilesCount = 0;
    if (expiredTalks && expiredTalks.length > 0) {
      for (const talk of expiredTalks) {
        if (talk.file_url) {
          try {
            // Estrai il path dal file_url
            const url = new URL(talk.file_url);
            const pathParts = url.pathname.split("/company-talks/");
            if (pathParts.length > 1) {
              const filePath = pathParts[1];

              const { error: deleteError } = await supabase.storage
                .from("company-talks")
                .remove([filePath]);

              if (deleteError) {
                console.error(`[Cleanup] Error deleting file ${filePath}:`, deleteError);
              } else {
                deletedFilesCount++;
                console.log(`[Cleanup] Deleted file: ${filePath}`);
              }
            }
          } catch (err) {
            console.error(`[Cleanup] Error parsing file URL ${talk.file_url}:`, err);
          }
        }
      }
    }

    // 3. Chiama la funzione SQL per eliminare i record
    const { data: deleteResult, error: deleteError } = await supabase
      .rpc("delete_expired_talks");

    if (deleteError) {
      console.error("[Cleanup] Error calling delete_expired_talks:", deleteError);
      throw deleteError;
    }

    const deletedCount = deleteResult || 0;
    console.log(`[Cleanup] Deleted ${deletedCount} expired talk records`);

    // 4. Restituisci il risultato
    const result = {
      success: true,
      deleted_records: deletedCount,
      deleted_files: deletedFilesCount,
      timestamp: new Date().toISOString(),
    };

    console.log("[Cleanup] Cleanup completed:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[Cleanup] Fatal error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
