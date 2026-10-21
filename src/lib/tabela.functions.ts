import { createServerFn } from "@tanstack/react-start";
import type { Bracket } from "@/lib/bracket";
import type { TournamentStatus } from "@/lib/painel.functions";

export interface PublicTournament {
  id: string;
  name: string;
  status: TournamentStatus;
  bracket: Bracket;
}

// PUBLIC read: returns only bracket data and team display names.
// Never add phones, order codes, payment status, or any registration detail here.
export const getPublicBracket = createServerFn({ method: "GET" }).handler(async (): Promise<{
  tournaments: PublicTournament[];
  teams: Record<string, string>;
}> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ts, error } = await supabaseAdmin
    .from("tournaments")
    .select("id, name, status, participant_ids, bracket")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar a tabela.");

  const ids = [...new Set((ts ?? []).flatMap((t) => (t.participant_ids as string[]) ?? []))];
  const teams: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: regs, error: rerr } = await supabaseAdmin
      .from("team_registrations")
      .select("id, player1_name, player2_name")
      .in("id", ids);
    if (rerr) throw new Error("Não foi possível carregar as duplas.");
    for (const r of regs ?? []) teams[r.id] = `${r.player1_name} & ${r.player2_name}`;
  }

  return {
    tournaments: (ts ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status as TournamentStatus,
      bracket: t.bracket as unknown as Bracket,
    })),
    teams,
  };
});
