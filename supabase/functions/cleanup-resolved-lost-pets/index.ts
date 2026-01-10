import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffISOString = cutoffDate.toISOString();

    console.log(`[cleanup-resolved-lost-pets] Running cleanup for posts resolved before ${cutoffISOString}`);

    // First, get the posts that will be deleted for logging
    const { data: postsToDelete, error: fetchError } = await supabase
      .from("lost_pet_posts")
      .select("id, pet_name, status, updated_at, user_id")
      .in("status", ["found", "reunited"])
      .lt("updated_at", cutoffISOString);

    if (fetchError) {
      console.error("[cleanup-resolved-lost-pets] Error fetching posts to delete:", fetchError);
      throw fetchError;
    }

    const postCount = postsToDelete?.length || 0;
    console.log(`[cleanup-resolved-lost-pets] Found ${postCount} resolved posts older than 30 days`);

    if (postCount === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No posts to delete",
          deleted_count: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete associated photos from storage first
    for (const post of postsToDelete || []) {
      try {
        // List and delete files in the lost-pet-photos bucket for this post
        const { data: files } = await supabase.storage
          .from("lost-pet-photos")
          .list(post.id);
        
        if (files && files.length > 0) {
          const filePaths = files.map(f => `${post.id}/${f.name}`);
          await supabase.storage.from("lost-pet-photos").remove(filePaths);
          console.log(`[cleanup-resolved-lost-pets] Deleted ${filePaths.length} photos for post ${post.id}`);
        }
      } catch (storageError) {
        console.warn(`[cleanup-resolved-lost-pets] Could not delete photos for post ${post.id}:`, storageError);
        // Continue with deletion even if photo cleanup fails
      }
    }

    // Delete the posts
    const postIds = postsToDelete?.map(p => p.id) || [];
    const { error: deleteError, count } = await supabase
      .from("lost_pet_posts")
      .delete()
      .in("id", postIds);

    if (deleteError) {
      console.error("[cleanup-resolved-lost-pets] Error deleting posts:", deleteError);
      throw deleteError;
    }

    console.log(`[cleanup-resolved-lost-pets] Successfully deleted ${count || postCount} resolved lost pet posts`);

    // Log the cleanup action
    await supabase.from("audit_logs").insert({
      admin_id: null, // System action
      action: "auto_cleanup_lost_pet_posts",
      entity_type: "lost_pet_posts",
      entity_id: null,
      changes: {
        deleted_count: count || postCount,
        deleted_posts: postsToDelete?.map(p => ({
          id: p.id,
          pet_name: p.pet_name,
          status: p.status,
          resolved_at: p.updated_at,
        })),
        cutoff_date: cutoffISOString,
        cleanup_reason: "Automatic 30-day cleanup of resolved lost pet posts",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully deleted ${count || postCount} resolved lost pet posts older than 30 days`,
        deleted_count: count || postCount,
        deleted_posts: postsToDelete?.map(p => ({ id: p.id, pet_name: p.pet_name, status: p.status })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[cleanup-resolved-lost-pets] Error:", errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
