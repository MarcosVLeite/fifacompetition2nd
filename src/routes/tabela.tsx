import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { getPublicBracket, type PublicTournament } from "@/lib/tabela.functions";
import { champion, pendingCount, roundName, type Match } from "@/lib/bracket";

const tabelaQuery = queryOptions({
  queryKey: ["tabela-publica"],
  queryFn: () => getPublicBracket(),
  refetchInterval: 15_000, // atualização quase em tempo real para a torcida
});

export const Route = createFileRoute("/tabela")({
  loader: ({ context }) => context.queryClient.ensureQueryData(tabelaQuery),
  head: () => ({
    meta: [
      { title: "Tabela do campeonato | CNA FIFA COMPETITION" },
      { name: "description", content: "Acompanhe ao vivo a chave mata-mata do CNA FIFA COMPETITION: confrontos, placares e a campeã." },
      { property: "og:title", content: "Tabela do campeonato | CNA FIFA COMPETITION" },
      { property: "og:description", content: "Acompanhe ao vivo a chave mata-mata: confrontos, placares e a campeã." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div role="alert" className="min-h-screen bg-background px-4 py-10 text-foreground">
      Não foi possível carregar a tabela agora. {error instanceof Error ? error.message : String(error)}
    </div>
  ),
  notFoundComponent: () => <div className="min-h-screen bg-background px-4 py-10 text-foreground">Página não encontrada.</div>,
  component: Tabela,
});

const STATUS: Record<string, string> = { aguardando: "Aguardando início", em_andamento: "Em andamento", finalizado: "Finalizado" };

function initials(label: string) {
  return label.split("&").map((p) => p.trim()[0] ?? "").join("").toUpperCase();
}

function Avatar({ label }: { label: string }) {
  return <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">{initials(label)}</span>;
}

function Tabela() {
  const { data, dataUpdatedAt } = useSuspenseQuery(tabelaQuery);
  const [selectedId, setSelectedId] = useState<string | null>(data.tournaments[0]?.id ?? null);
  const selected = data.tournaments.find((t) => t.id === selectedId) ?? data.tournaments[0] ?? null;
  const atualizado = new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-foreground">TABELA DO CAMPEONATO</h1>
            <p className="mt-1 text-sm text-muted-foreground">Mata-mata ao vivo — CNA FIFA COMPETITION</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Atualiza automaticamente · visto às {atualizado} · <Link to="/" className="underline underline-offset-4">Página inicial</Link>
          </p>
        </div>

        {data.tournaments.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {data.tournaments.map((t) => (
              <button key={t.id} onClick={() => setSelectedId(t.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${t.id === selected?.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <span className="block font-medium text-foreground">{t.name}</span>
                <span className={`text-xs ${t.status === "finalizado" ? "text-info" : t.status === "em_andamento" ? "text-primary" : "text-muted-foreground"}`}>{STATUS[t.status]}</span>
              </button>
            ))}
          </div>
        )}

        {selected ? (
          <PublicTournamentView key={selected.id} t={selected} teams={data.teams} />
        ) : (
          <div className="mt-16 rounded-xl border border-border bg-card p-10 text-center">
            <Trophy className="mx-auto h-12 w-12 text-primary" />
            <p className="mt-4 font-display text-xl text-foreground">AS CHAVES SERÃO SORTEADAS EM BREVE</p>
            <p className="mt-2 text-sm text-muted-foreground">Volte no dia do evento para acompanhar os confrontos ao vivo.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PublicTournamentView({ t, teams }: { t: PublicTournament; teams: Record<string, string> }) {
  const champ = champion(t.bracket);
  const pending = pendingCount(t.bracket);
  const rounds = useMemo(
    () => Array.from({ length: t.bracket.rounds }, (_, r) => t.bracket.matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot)),
    [t],
  );
  const label = (id: string | null) => (id ? teams[id] ?? "Dupla" : "");

  return (
    <div className="mt-8">
      {t.status === "finalizado" && champ && (
        <div className="champion-card mb-6 rounded-xl border border-primary bg-card p-6 text-center">
          <Trophy className="mx-auto h-12 w-12 text-primary" />
          <p className="mt-2 text-xs uppercase tracking-widest text-info">Campeã do {t.name}</p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{initials(label(champ))}</span>
            <p className="font-display text-2xl text-foreground">{label(champ)}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl text-foreground">{t.name}</h2>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{STATUS[t.status]}</span>
        {t.status !== "finalizado" && <span className="text-xs text-muted-foreground">{pending} partida(s) pendente(s)</span>}
      </div>

      <div className="bracket mt-6 overflow-x-auto pb-4">
        <div className="flex min-w-max gap-8">
          {rounds.map((ms, r) => (
            <div key={r} className="flex w-64 flex-col">
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-info">{roundName(r, t.bracket.rounds)}</p>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {ms.map((m) => (
                  <PublicMatchCard key={m.id} m={m} label={label} last={r === t.bracket.rounds - 1} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PublicMatchCard({ m, label, last }: { m: Match; label: (id: string | null) => string; last: boolean }) {
  const row = (id: string | null, score: number | null) => {
    const won = !!m.winner && m.winner === id;
    const lost = !!m.winner && !!id && m.winner !== id;
    return (
      <div className={`flex items-center gap-2 px-2 py-1.5 ${won ? "match-winner bg-primary/15" : ""} ${lost ? "opacity-50" : ""}`}>
        {id ? <Avatar label={label(id)} /> : <span className="h-7 w-7" />}
        <span className={`min-w-0 flex-1 truncate text-sm ${won ? "font-semibold text-foreground" : "text-foreground"}`}>
          {id ? label(id) : m.bye ? <em className="text-muted-foreground">BYE</em> : <span className="text-muted-foreground">A definir</span>}
        </span>
        {score !== null && <span className={`text-sm ${won ? "font-bold text-foreground" : "text-muted-foreground"}`}>{score}</span>}
      </div>
    );
  };

  return (
    <div className={`match-card relative rounded-lg border bg-card ${last ? "" : "has-next"} ${m.winner ? "border-primary/60" : "border-border"}`}>
      {row(m.a, m.scoreA)}
      <div className="border-t border-border/60" />
      {row(m.b, m.scoreB)}
      {m.bye && <p className="px-2 pb-1 text-[10px] text-muted-foreground">Avança direto (BYE)</p>}
    </div>
  );
}
