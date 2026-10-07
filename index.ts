import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function digits(v: unknown) { return String(v ?? "").replace(/\D/g, ""); }
function validCpf(v: unknown) {
  const cpf = digits(v);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === Number(cpf[10]);
}
function validEmail(v: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? "").trim());
}
function validPassword(v: unknown) {
  return /^\d{6}$/.test(String(v ?? ""));
}

async function audit(actorId: string, action: string, targetId: string | null, detail: string) {
  try {
    await adminClient.from("audit_logs").insert({ actor_id: actorId, action, target_id: targetId, detail });
  } catch (e) {
    console.error("ARI-CPA7 audit log error", e);
  }
}

async function getAdmin(token: string) {
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id,name,cpf,role,status")
    .eq("id", data.user.id)
    .single();
  if (!profile || profile.role !== "admin" || profile.status !== "ativo") return null;
  return profile;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Não autenticado." }, 401);

    const admin = await getAdmin(token);
    if (!admin) return json({ error: "Apenas administradores ativos podem executar esta operação." }, 403);

    const body = await req.json();
    const action = String(body.action || "").toLowerCase();

    if (action === "create") {
      const name = String(body.name || "").trim();
      const cpf = digits(body.cpf);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const role = body.role === "admin" ? "admin" : body.role === "operator" ? "operator" : "";

      if (!name) return json({ error: "Informe o nome." }, 400);
      if (!validCpf(cpf)) return json({ error: "CPF inválido." }, 400);
      if (!validEmail(email)) return json({ error: "E-mail inválido." }, 400);
      if (!validPassword(password)) return json({ error: "A senha inicial deve possuir exatamente 6 dígitos." }, 400);
      if (!role) return json({ error: "Perfil inválido." }, 400);

      const { data: existingCpf } = await adminClient.from("profiles").select("id").eq("cpf", cpf).maybeSingle();
      if (existingCpf) return json({ error: "Este CPF já está cadastrado." }, 409);
      const { data: existingEmail } = await adminClient.from("profiles").select("id").ilike("auth_email", email).maybeSingle();
      if (existingEmail) return json({ error: "Este e-mail já está cadastrado." }, 409);

      const { data: created, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, cpf, role },
      });
      if (authError || !created.user) return json({ error: authError?.message || "Não foi possível criar o usuário de autenticação." }, 400);

      const { error: profileError } = await adminClient.from("profiles").insert({
        id: created.user.id,
        name,
        cpf,
        auth_email: email,
        role,
        status: "ativo",
      });

      if (profileError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        return json({ error: profileError.message }, 400);
      }

      await audit(admin.id, "CREATE_USER", created.user.id, `${name} / ${cpf} / ${email} / ${role}`);
      return json({ ok: true, user: { id: created.user.id, name, cpf, auth_email: email, role, status: "ativo" } }, 201);
    }

    if (action === "update") {
      const userId = String(body.user_id || "");
      const name = String(body.name || "").trim();
      const cpf = digits(body.cpf);
      const email = String(body.email || "").trim().toLowerCase();
      const role = body.role === "admin" ? "admin" : body.role === "operator" ? "operator" : "";
      const password = body.password ? String(body.password) : "";

      if (!userId) return json({ error: "Usuário não informado." }, 400);
      if (!name) return json({ error: "Informe o nome." }, 400);
      if (!validCpf(cpf)) return json({ error: "CPF inválido." }, 400);
      if (!validEmail(email)) return json({ error: "E-mail inválido." }, 400);
      if (!role) return json({ error: "Perfil inválido." }, 400);
      if (password && !validPassword(password)) return json({ error: "A senha deve possuir exatamente 6 dígitos." }, 400);

      const { data: target, error: targetError } = await adminClient.from("profiles").select("id,name,cpf,auth_email,role,status").eq("id", userId).single();
      if (targetError || !target) return json({ error: "Usuário não encontrado." }, 404);

      const { data: dupCpf } = await adminClient.from("profiles").select("id").eq("cpf", cpf).neq("id", userId).maybeSingle();
      if (dupCpf) return json({ error: "Este CPF já está cadastrado." }, 409);
      const { data: dupEmail } = await adminClient.from("profiles").select("id").ilike("auth_email", email).neq("id", userId).maybeSingle();
      if (dupEmail) return json({ error: "Este e-mail já está cadastrado." }, 409);

      if (target.role === "admin" && role !== "admin" && target.status === "ativo") {
        const { count } = await adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("status", "ativo");
        if ((count ?? 0) <= 1) return json({ error: "O sistema precisa manter pelo menos um administrador ativo." }, 400);
      }

      const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
        email,
        ...(password ? { password } : {}),
        user_metadata: { name, cpf, role },
      });
      if (authError) return json({ error: authError.message }, 400);

      const { data: updated, error: profileError } = await adminClient.from("profiles").update({
        name,
        cpf,
        auth_email: email,
        role,
        updated_at: new Date().toISOString(),
      }).eq("id", userId).select("id,name,cpf,auth_email,role,status").single();
      if (profileError) return json({ error: profileError.message }, 400);

      await audit(admin.id, "UPDATE_USER", userId, `${name} / ${cpf} / ${email} / ${role}`);
      return json({ ok: true, user: updated });
    }

    if (action === "delete") {
      const userId = String(body.user_id || "");
      if (!userId) return json({ error: "Usuário não informado." }, 400);
      const { data: target } = await adminClient.from("profiles").select("id,name,cpf,role,status").eq("id", userId).single();
      if (!target) return json({ error: "Usuário não encontrado." }, 404);
      if (target.role === "admin" && target.status === "ativo") {
        const { count } = await adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("status", "ativo");
        if ((count ?? 0) <= 1) return json({ error: "Não é possível excluir o último administrador ativo." }, 400);
      }
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      await audit(admin.id, "DELETE_USER", userId, `${target.name} / ${target.cpf}`);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error("ARI-CPA7 admin-users", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
