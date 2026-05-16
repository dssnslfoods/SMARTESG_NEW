import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ----- 1. Verify caller via JWT in Authorization header -----
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: callerData, error: callerError } = await anonClient.auth.getUser(token);
    if (callerError || !callerData?.user) {
      return json({ error: "Invalid or expired session" }, 401);
    }
    const caller = callerData.user;

    // ----- 2. Lookup caller role -----
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerRoleRow, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (roleErr) {
      console.error("Role lookup error:", roleErr);
      return json({ error: "Cannot verify caller role" }, 500);
    }
    const callerRole = callerRoleRow?.role as string | undefined;

    // ----- 3. Validate inputs -----
    const { email, newPassword } = await req.json();
    if (!email || !newPassword) {
      return json({ error: "Missing email or newPassword" }, 400);
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    // ----- 4. Find target user by email -----
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error("List users error:", listError);
      return json({ error: listError.message }, 400);
    }
    const target = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!target) {
      return json({ error: "User not found" }, 404);
    }

    const isSelf = target.id === caller.id;

    // ----- 5. Lookup target role to prevent supervisor from resetting admin -----
    const { data: targetRoleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", target.id)
      .maybeSingle();
    const targetRole = targetRoleRow?.role as string | undefined;

    // ----- 6. Authorization rules -----
    // - User can always change their own password
    // - admin can reset anyone
    // - supervisor can reset non-admin users
    // - everyone else: forbidden
    const isAdmin = callerRole === "admin";
    const isSupervisor = callerRole === "supervisor";

    let allowed = false;
    if (isSelf) {
      allowed = true;
    } else if (isAdmin) {
      allowed = true;
    } else if (isSupervisor && targetRole !== "admin") {
      allowed = true;
    }

    if (!allowed) {
      return json(
        {
          error:
            "Forbidden: only admin or supervisor can reset other users' passwords. Supervisor cannot reset admin.",
        },
        403,
      );
    }

    // ----- 7. Perform update via admin API -----
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
      password: newPassword,
    });
    if (updateError) {
      console.error("Update password error:", updateError);
      return json({ error: updateError.message }, 400);
    }

    console.log(
      `Password updated for user=${email} by caller=${caller.email} (role=${callerRole}, self=${isSelf})`,
    );

    return json({ success: true, message: "Password updated successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return json({ error: message }, 500);
  }
});
