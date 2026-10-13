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
}

// Protected DATA lives behind the server boundary: gated here, returned only
// when unlocked. The handler body is stripped from the client bundle.
export const getTeamRegistrations = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ registrations: TeamRegistrationRow[] }> => {
    await requireUnlocked();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .select("id, created_at, player1_name, player2_name, phone, is_cna_student")
      .order("created_at", { ascending: true });

    if (error) throw new Error("Não foi possível carregar as inscrições.");

    return {
      registrations: (data ?? []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        player1Name: row.player1_name,
        player2Name: row.player2_name,
        phone: row.phone,
        isCnaStudent: row.is_cna_student,
      })),
    };
  },
);
