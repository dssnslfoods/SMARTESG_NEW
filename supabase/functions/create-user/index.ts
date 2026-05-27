import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Get the authorization header to verify caller is admin
    const authHeader = req.headers.get("authorization");
    
    // Create client with user's token to check their role
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
      auth: { persistSession: false },
    });
    
    // Get current user
    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();
    
    if (authError || !caller) {
      console.log("Auth error or no caller:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Please login first" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check if caller is admin using service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    // Also check the super_admin table (belt-and-suspenders).
    const { data: superAdminRow } = await supabaseAdmin
      .from("super_admin")
      .select("user_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    const isAdmin = roleData?.role === "admin";
    const isSupervisor = roleData?.role === "supervisor";
    const isSuperAdmin = roleData?.role === "super_admin" || !!superAdminRow;

    if (!isAdmin && !isSupervisor && !isSuperAdmin) {
      console.log("Caller not allowed to create users:", caller.id, roleData);
      return new Response(
        JSON.stringify({ error: "Forbidden - Only admins, supervisors and super admins can create users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which tenant the new user belongs to:
    //   • admin / supervisor → their own tenant
    //   • super_admin        → the tenant they're currently "viewing"
    // Both are simply the caller's app_user_profile.tenant_id.
    const { data: callerProfile } = await supabaseAdmin
      .from("app_user_profile")
      .select("tenant_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    const targetTenantId = callerProfile?.tenant_id ?? null;

    if (!targetTenantId) {
      console.log("Caller has no tenant_id:", caller.id);
      return new Response(
        JSON.stringify({ error: "Cannot determine target tenant for the new user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, fullName, role } = await req.json();

    if (!email || !password || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user via admin API
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      console.log("Create user error:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile with full name + assign to the target tenant.
    // (The signup trigger defaults tenant_id to NSL because there's no auth
    // context inside the trigger, so we must overwrite it explicitly here.)
    await supabaseAdmin
      .from("app_user_profile")
      .update({ full_name: fullName, is_active: true, tenant_id: targetTenantId })
      .eq("user_id", userData.user.id);

    // Assign role + same tenant (upsert since the trigger created a guest row).
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userData.user.id, role, tenant_id: targetTenantId },
        { onConflict: "user_id" }
      );

    if (roleError) {
      console.log("Role upsert error:", roleError);
      return new Response(
        JSON.stringify({ error: roleError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User created successfully:", email, role);

    return new Response(
      JSON.stringify({ success: true, userId: userData.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
