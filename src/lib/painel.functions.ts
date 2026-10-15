import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

const sessionConfig = {
  password: process.env["SESSION_SECRET"]!, // server-only; 32+ chars
  name: "painel-gate",
  maxAge: 60 * 60 * 24 * 7, // 7 days
  cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
};

type PainelSession = { unlocked?: boolean };

// Hash both sides to equal-length digests first: timingSafeEqual throws on a
// length mismatch, and the raw length itself would leak through timing.
function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

// Server-only gate: throws a redirect BEFORE any protected work runs.
async function requireUnlocked() {
  const session = await useSession<PainelSession>(sessionConfig);
  if (!session.data.unlocked) throw redirect({ to: "/entrar" });
  return session;
}

export const unlockPainel = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env["SITE_PASSWORD"];
    if (!expected) throw new Error("SITE_PASSWORD is not set");

    if (!passwordMatches(data.password, expected)) {
      return { ok: false as const }; // generic failure — reveal nothing more
    }

    const session = await useSession<PainelSession>(sessionConfig);
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockPainel = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<PainelSession>(sessionConfig);
  await session.clear();
  return { ok: true as const };
});

export interface TeamRegistrationRow {
  id: string;
  createdAt: string;
  player1Name: string;
  player2Name: string;
  phone: string;
  isCnaStudent: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  orderCode: string;
  paymentStatus: string;
  hasReceipt: boolean;
  paidClaimedAt: string | null;
  decidedAt: string | null;
  refusalReason: string | null;
}

async function loadRegistrations(): Promise<TeamRegistrationRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("team_registrations")
    .select("id, created_at, player1_name, player2_name, phone, is_cna_student, is_blocked, block_reason, order_code, payment_status, receipt_path, paid_claimed_at, decided_at, refusal_reason")
    .order("created_at", { ascending: true });
  if (error) throw new Error("Não foi possível carregar as inscrições.");
  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    player1Name: row.player1_name,
    player2Name: row.player2_name,
    phone: row.phone,
    isCnaStudent: row.is_cna_student,
    isBlocked: row.is_blocked,
    blockReason: row.block_reason,
    orderCode: row.order_code ?? "",
    paymentStatus: row.payment_status,
    hasReceipt: !!row.receipt_path,
    paidClaimedAt: row.paid_claimed_at,
    decidedAt: row.decided_at,
    refusalReason: row.refusal_reason,
  }));
}

// Protected DATA lives behind the server boundary: gated here, returned only
// when unlocked. The handler body is stripped from the client bundle.
export const getTeamRegistrations = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ registrations: TeamRegistrationRow[] }> => {
    await requireUnlocked();
    return { registrations: await loadRegistrations() };
  },
);

// AI duplicate check: analyzes non-blocked registrations and blocks each
// likely duplicate (the newer entry) with the model's explanation.
export const detectAndBlockDuplicates = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; blocked: number } | { ok: false; error: string }> => {
    await requireUnlocked();
    const rows = (await loadRegistrations()).filter((r) => !r.isBlocked);
    const { detectDuplicates, GatewayError } = await import("./duplicates.server");
    let matches;
    try {
      matches = await detectDuplicates(rows);
    } catch (e) {
      if (e instanceof GatewayError) return { ok: false, error: e.message };
      console.error(e);
      return { ok: false, error: "A análise por IA falhou. Tente novamente." };
    }
    const byId = new Map(rows.map((r) => [r.id, r]));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const m of matches) {
      const orig = byId.get(m.originalId)!;
      const reason = `Possível duplicata de ${orig.player1Name} & ${orig.player2Name}: ${m.explanation}`;
      await supabaseAdmin
        .from("team_registrations")
        .update({ is_blocked: true, block_reason: reason.slice(0, 600) })
        .eq("id", m.duplicateId);
    }
    return { ok: true, blocked: matches.length };
  },
);

export const unblockTeamRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(String(input?.id ?? ""))) throw new Error("Inscrição inválida.");
    return { id: input.id };
  })
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("team_registrations")
      .update({ is_blocked: false, block_reason: null })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível desbloquear.");
    return { ok: true as const };
  });

const uuidRe = /^[0-9a-f-]{36}$/i;

function validateUpdate(input: unknown) {
  const d = input as Record<string, unknown>;
  const id = String(d?.["id"] ?? "");
  const player1Name = String(d?.["player1Name"] ?? "").trim();
  const player2Name = String(d?.["player2Name"] ?? "").trim();
  const phone = String(d?.["phone"] ?? "").trim();
  if (!uuidRe.test(id)) throw new Error("Inscrição inválida.");
  if (player1Name.length < 3 || player1Name.length > 100) throw new Error("Nome do jogador 1 inválido.");
  if (player2Name.length < 3 || player2Name.length > 100) throw new Error("Nome do jogador 2 inválido.");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) throw new Error("Telefone inválido (inclua o DDD).");
  return { id, player1Name, player2Name, phone, isCnaStudent: d?.["isCnaStudent"] === true };
}

export const updateTeamRegistration = createServerFn({ method: "POST" })
  .inputValidator(validateUpdate)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("team_registrations")
      .update({
        player1_name: data.player1Name,
        player2_name: data.player2Name,
        phone: data.phone,
        is_cna_student: data.isCnaStudent,
      })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível salvar as alterações.");
    return { ok: true as const };
  });

export const deleteTeamRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => {
    if (!uuidRe.test(String(input?.id ?? ""))) throw new Error("Inscrição inválida.");
    return { id: input.id };
  })
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("team_registrations").delete().eq("id", data.id);
    if (error) throw new Error("Não foi possível apagar a inscrição.");
    return { ok: true as const };
  });

export const setPaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; status: "confirmado" | "recusado"; reason?: string }) => {
    if (!uuidRe.test(String(input?.id ?? ""))) throw new Error("Inscrição inválida.");
    if (input.status !== "confirmado" && input.status !== "recusado") throw new Error("Status inválido.");
    const reason = String(input.reason ?? "").trim().slice(0, 300);
    if (input.status === "recusado" && reason.length < 3) throw new Error("Informe o motivo da recusa.");
    return { id: input.id, status: input.status, reason };
  })
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("team_registrations")
      .update({
        payment_status: data.status,
        decided_at: new Date().toISOString(),
        refusal_reason: data.status === "recusado" ? data.reason : null,
      })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível atualizar o pagamento.");
    return { ok: true as const };
  });

export const getReceiptUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => {
    if (!uuidRe.test(String(input?.id ?? ""))) throw new Error("Inscrição inválida.");
    return { id: input.id };
  })
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("team_registrations").select("receipt_path").eq("id", data.id).maybeSingle();
    if (!row?.receipt_path) throw new Error("Sem comprovante.");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("comprovantes").createSignedUrl(row.receipt_path, 300);
    if (error || !signed) throw new Error("Não foi possível abrir o comprovante.");
    return { url: signed.signedUrl };
  });
