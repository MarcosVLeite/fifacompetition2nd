import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";
import { generateBracket, setResult, clearResult, isStarted, pendingCount, type Bracket } from "@/lib/bracket";

function getSessionConfig() { return {
  password: process.env["SESSION_SECRET"]!, // server-only; 32+ chars
  name: "painel-gate",
  maxAge: 60 * 60 * 24 * 7, // 7 days
  cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
}; }

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
  const session = await useSession<PainelSession>(getSessionConfig());
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

    const session = await useSession<PainelSession>(getSessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockPainel = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<PainelSession>(getSessionConfig());
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

// ---------------- Campeonatos (mata-mata) ----------------

export type TournamentStatus = "aguardando" | "em_andamento" | "finalizado";
export interface TournamentDTO {
  id: string; name: string; status: TournamentStatus; participantIds: string[];
  bracket: Bracket; version: number; createdAt: string;
}
export interface TeamOption { id: string; label: string; orderCode: string; paymentStatus: string }

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

function toDTO(r: { id: string; name: string; status: string; participant_ids: string[]; bracket: unknown; version: number; created_at: string }): TournamentDTO {
  return { id: r.id, name: r.name, status: r.status as TournamentStatus, participantIds: r.participant_ids, bracket: r.bracket as Bracket, version: r.version, createdAt: r.created_at };
}

async function validTeamIds(ids: string[]) {
  if (new Set(ids).size !== ids.length) throw new Error("Há duplas repetidas na seleção.");
  if (ids.length < 2) throw new Error("Selecione pelo menos 2 duplas.");
  if (ids.length > 128) throw new Error("Máximo de 128 duplas.");
  const { data, error } = await (await admin()).from("team_registrations").select("id").in("id", ids).eq("is_blocked", false);
  if (error) throw new Error("Não foi possível validar as duplas.");
  if ((data ?? []).length !== ids.length) throw new Error("Alguma dupla selecionada não existe mais ou está bloqueada. Atualize a página.");
}

async function loadTournament(id: string) {
  const { data, error } = await (await admin()).from("tournaments").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Campeonato não encontrado.");
  return toDTO(data);
}

// Optimistic concurrency: write only if nobody saved since the client loaded `version`.
async function save(id: string, version: number, patch: { name?: string; status?: TournamentStatus; participant_ids?: string[]; bracket?: Bracket }) {
  const { data, error } = await (await admin()).from("tournaments")
    .update({ ...patch, bracket: patch.bracket as never, version: version + 1, updated_at: new Date().toISOString() })
    .eq("id", id).eq("version", version).select("*");
  if (error) throw new Error("Não foi possível salvar o campeonato.");
  if (!data || data.length === 0) throw new Error("Outro organizador alterou este campeonato. Atualize a página e tente de novo.");
  return toDTO(data[0]!);
}

function statusFor(b: Bracket): TournamentStatus {
  return isStarted(b) ? "em_andamento" : "aguardando";
}

export const getTournaments = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const db = await admin();
  const [t, r] = await Promise.all([
    db.from("tournaments").select("*").order("created_at", { ascending: false }),
    db.from("team_registrations").select("id, player1_name, player2_name, order_code, payment_status, is_blocked").order("created_at", { ascending: true }),
  ]);
  if (t.error || r.error) throw new Error("Não foi possível carregar os campeonatos.");
  const teams: Record<string, string> = {};
  const options: TeamOption[] = [];
  for (const x of r.data ?? []) {
    const label = `${x.player1_name} & ${x.player2_name}`;
    teams[x.id] = label;
    if (!x.is_blocked) options.push({ id: x.id, label, orderCode: x.order_code ?? "", paymentStatus: x.payment_status });
  }
  return { tournaments: (t.data ?? []).map(toDTO), teams, options };
});

export const createTournament = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; participantIds: string[] }) => d)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const name = data.name.trim();
    if (name.length < 2 || name.length > 80) throw new Error("Dê um nome de 2 a 80 letras ao campeonato.");
    await validTeamIds(data.participantIds);
    const bracket = generateBracket(data.participantIds);
    const { data: row, error } = await (await admin()).from("tournaments")
      .insert({ name, participant_ids: data.participantIds, bracket: bracket as never, status: "aguardando" }).select("*").single();
    if (error || !row) throw new Error("Não foi possível criar o campeonato.");
    return toDTO(row);
  });

export const regenerateTournament = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; version: number; name: string; participantIds: string[]; confirmWipe: boolean }) => d)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const t = await loadTournament(data.id);
    if (isStarted(t.bracket) && !data.confirmWipe) throw new Error("O campeonato já começou: confirme que quer apagar todos os resultados.");
    const name = data.name.trim();
    if (name.length < 2 || name.length > 80) throw new Error("Dê um nome de 2 a 80 letras ao campeonato.");
    await validTeamIds(data.participantIds);
    return save(data.id, data.version, { name, participant_ids: data.participantIds, bracket: generateBracket(data.participantIds), status: "aguardando" });
  });

export const restartTournament = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; version: number; confirmWipe: boolean }) => {
    if (!uuidRe.test(String(d?.id ?? "")) || !Number.isInteger(d?.version) || d.version < 1) throw new Error("Campeonato inválido.");
    if (d.confirmWipe !== true) throw new Error("Confirme que quer recomeçar e apagar todos os resultados.");
    return { id: d.id, version: d.version, confirmWipe: true };
  })
  .handler(async ({ data }) => {
    await requireUnlocked();
    const t = await loadTournament(data.id);
    await validTeamIds(t.participantIds);
    return save(t.id, data.version, { bracket: generateBracket(t.participantIds), status: "aguardando" });
  });

export const saveMatchResult = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; version: number; matchId: string; scoreA: number | null; scoreB: number | null }) => d)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const t = await loadTournament(data.id);
    const bracket = data.scoreA === null || data.scoreB === null
      ? clearResult(t.bracket, data.matchId)
      : setResult(t.bracket, data.matchId, data.scoreA, data.scoreB);
    // A correction after finishing reopens the tournament.
    return save(data.id, data.version, { bracket, status: statusFor(bracket) });
  });

export const finishTournament = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; version: number }) => d)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const t = await loadTournament(data.id);
    const pending = pendingCount(t.bracket);
    if (pending > 0) throw new Error(`Ainda há ${pending} partida(s) pendente(s).`);
    return save(data.id, data.version, { status: "finalizado" });
  });

export const deleteTournament = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { error } = await (await admin()).from("tournaments").delete().eq("id", data.id);
    if (error) throw new Error("Não foi possível apagar o campeonato.");
    return { ok: true };
  });
