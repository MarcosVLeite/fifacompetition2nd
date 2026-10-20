import { useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trophy } from "lucide-react";
import {
  createTournament, deleteTournament, finishTournament, getTournaments,
  regenerateTournament, saveMatchResult, type TeamOption, type TournamentDTO,
} from "@/lib/painel.functions";
import { champion, isStarted, pendingCount, roundName, type Match } from "@/lib/bracket";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/chaves")({
  loader: () => getTournaments(),
  head: () => ({
    meta: [
      { title: "Chaves do campeonato | CNA FIFA COMPETITION" },
      { name: "description", content: "Organização das chaves mata-mata do campeonato (acesso restrito)." },
      { property: "og:title", content: "Chaves do campeonato | CNA FIFA COMPETITION" },
      { property: "og:description", content: "Chaves mata-mata do CNA FIFA COMPETITION." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Chaves,
});

const STATUS: Record<string, string> = { aguardando: "Aguardando início", em_andamento: "Em andamento", finalizado: "Finalizado" };
const inputCls = "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function initials(label: string) {
  return label.split("&").map((p) => p.trim()[0] ?? "").join("").toUpperCase();
}

function Avatar({ label }: { label: string }) {
  return <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">{initials(label)}</span>;
}

function Chaves() {
  const { tournaments, teams, options } = Route.useLoaderData();
  const [selectedId, setSelectedId] = useState<string | null>(tournaments[0]?.id ?? null);
  const [creating, setCreating] = useState(tournaments.length === 0);
  const selected = tournaments.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-foreground">CHAVES DO CAMPEONATO</h1>
            <p className="mt-1 text-sm text-muted-foreground">Mata-mata com as duplas inscritas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="arena" onClick={() => { setCreating(true); setSelectedId(null); }}>Novo campeonato</Button>
            <Button variant="arenaOutline" asChild><Link to="/painel">Voltar ao painel</Link></Button>
          </div>
        </div>

        {tournaments.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {tournaments.map((t) => (
              <button key={t.id} onClick={() => { setSelectedId(t.id); setCreating(false); }}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${t.id === selectedId && !creating ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <span className="block font-medium text-foreground">{t.name}</span>
                <span className={`text-xs ${t.status === "finalizado" ? "text-info" : t.status === "em_andamento" ? "text-primary" : "text-muted-foreground"}`}>{STATUS[t.status]}</span>
              </button>
            ))}
          </div>
        )}

        {creating ? (
          <Setup key="new" options={options} onDone={(id) => { setSelectedId(id); setCreating(false); }} />
        ) : selected ? (
          <TournamentView key={selected.id + selected.version} t={selected} teams={teams} options={options} onDeleted={() => setSelectedId(null)} />
        ) : (
          <p className="mt-10 text-muted-foreground">Escolha um campeonato acima.</p>
        )}
      </div>
    </div>
  );
}

function Setup({ options, existing, onDone, onCancel }: {
  options: TeamOption[]; existing?: TournamentDTO; onDone: (id: string) => void; onCancel?: () => void;
}) {
  const router = useRouter();
  const create = useServerFn(createTournament);
  const regen = useServerFn(regenerateTournament);
  const [name, setName] = useState(existing?.name ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set(existing?.participantIds.filter((id) => options.some((o) => o.id === id)) ?? []));
  const [onlyPaid, setOnlyPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visible = onlyPaid ? options.filter((o) => o.paymentStatus === "confirmado") : options;

  function toggle(id: string) {
    const n = new Set(picked);
    if (n.has(id)) n.delete(id); else n.add(id);
    setPicked(n);
  }

  async function submit() {
    const started = existing && isStarted(existing.bracket);
    if (started && !window.confirm("O campeonato já começou. Gerar de novo APAGA todos os resultados. Continuar?")) return;
    setBusy(true); setError(null);
    try {
      const ids = [...picked];
      const t = existing
        ? await regen({ data: { id: existing.id, version: existing.version, name, participantIds: ids, confirmWipe: !!started } })
        : await create({ data: { name, participantIds: ids } });
      await router.invalidate();
      onDone(t.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-xl text-foreground">{existing ? "EDITAR E GERAR DE NOVO" : "NOVO CAMPEONATO"}</h2>
      <input aria-label="Nome do campeonato" placeholder="Nome do campeonato" className={`${inputCls} mt-4 w-full max-w-sm`} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-foreground">{picked.size} dupla(s) selecionada(s)</span>
        <button className="underline text-muted-foreground" onClick={() => setPicked(new Set(visible.map((o) => o.id)))}>Selecionar todas</button>
        <button className="underline text-muted-foreground" onClick={() => setPicked(new Set())}>Limpar</button>
        <label className="flex items-center gap-1 text-muted-foreground">
          <input type="checkbox" checked={onlyPaid} onChange={(e) => setOnlyPaid(e.target.checked)} /> Só pagamento confirmado
        </label>
      </div>
      {options.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhuma dupla ativa inscrita ainda.</p>
      ) : (
        <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((o) => (
            <label key={o.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${picked.has(o.id) ? "border-primary bg-primary/10" : "border-border"}`}>
              <input type="checkbox" checked={picked.has(o.id)} onChange={() => toggle(o.id)} />
              <Avatar label={o.label} />
              <span className="min-w-0 flex-1 truncate text-foreground">{o.label}</span>
              <span className="text-[10px] text-muted-foreground">{o.paymentStatus === "confirmado" ? "Pago" : o.orderCode}</span>
            </label>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button variant="arena" disabled={busy || picked.size < 2} onClick={submit}>{busy ? "Gerando…" : "Gerar chaves (sorteio)"}</Button>
        {onCancel && <Button variant="arenaOutline" onClick={onCancel}>Cancelar</Button>}
      </div>
    </div>
  );
}

function TournamentView({ t, teams, options, onDeleted }: { t: TournamentDTO; teams: Record<string, string>; options: TeamOption[]; onDeleted: () => void }) {
  const router = useRouter();
  const finish = useServerFn(finishTournament);
  const remove = useServerFn(deleteTournament);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = pendingCount(t.bracket);
  const champ = champion(t.bracket);
  const rounds = useMemo(() => Array.from({ length: t.bracket.rounds }, (_, r) => t.bracket.matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot)), [t]);
  const label = (id: string | null) => (id ? teams[id] ?? "Dupla removida" : "");

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); await router.invalidate(); } catch (e) { setError(e instanceof Error ? e.message : "Algo deu errado."); }
  }

  if (editing) return <Setup options={options} existing={t} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />;

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
        <span className="text-xs text-muted-foreground">{t.participantIds.length} duplas · {pending} partida(s) pendente(s)</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {t.status !== "finalizado" && (
          <Button size="sm" variant="arena" disabled={pending > 0} title={pending > 0 ? "Há partidas pendentes" : undefined}
            onClick={() => act(() => finish({ data: { id: t.id, version: t.version } }))}>Finalizar campeonato</Button>
        )}
        <Button size="sm" variant="arenaOutline" onClick={() => setEditing(true)}>Editar duplas / gerar de novo</Button>
        <Button size="sm" variant="destructive" onClick={() => {
          if (window.confirm(`Apagar o campeonato "${t.name}"?`)) void act(async () => { await remove({ data: { id: t.id } }); onDeleted(); });
        }}>Apagar</Button>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="bracket mt-6 overflow-x-auto pb-4">
        <div className="flex min-w-max gap-8">
          {rounds.map((ms, r) => (
            <div key={r} className="flex w-64 flex-col">
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-info">{roundName(r, t.bracket.rounds)}</p>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {ms.map((m) => (
                  <MatchCard key={m.id} m={m} t={t} label={label} last={r === t.bracket.rounds - 1} onError={setError} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ m, t, label, last, onError }: { m: Match; t: TournamentDTO; label: (id: string | null) => string; last: boolean; onError: (e: string | null) => void }) {
  const router = useRouter();
  const save = useServerFn(saveMatchResult);
  const [a, setA] = useState(m.scoreA?.toString() ?? "");
  const [b, setB] = useState(m.scoreB?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const ready = !!m.a && !!m.b && !m.bye;

  async function submit(clear = false) {
    setBusy(true); onError(null);
    try {
      await save({ data: { id: t.id, version: t.version, matchId: m.id, scoreA: clear ? null : Number(a), scoreB: clear ? null : Number(b) } });
      await router.invalidate();
    } catch (e) { onError(e instanceof Error ? e.message : "Algo deu errado."); } finally { setBusy(false); }
  }

  const row = (id: string | null, val: string, set: (v: string) => void, score: number | null) => {
    const won = !!m.winner && m.winner === id;
    const lost = !!m.winner && !!id && m.winner !== id;
    return (
      <div className={`flex items-center gap-2 px-2 py-1.5 ${won ? "match-winner bg-primary/15" : ""} ${lost ? "opacity-50" : ""}`}>
        {id ? <Avatar label={label(id)} /> : <span className="h-7 w-7" />}
        <span className={`min-w-0 flex-1 truncate text-sm ${won ? "font-semibold text-foreground" : "text-foreground"}`}>
          {id ? label(id) : m.bye ? <em className="text-muted-foreground">BYE</em> : <span className="text-muted-foreground">A definir</span>}
        </span>
        {ready ? (
          <input aria-label={`Placar ${label(id)}`} inputMode="numeric" className="w-10 rounded border border-border bg-background px-1 text-center text-sm text-foreground"
            value={val} onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 2))} />
        ) : score !== null ? <span className="text-sm">{score}</span> : null}
      </div>
    );
  };

  return (
    <div className={`match-card relative rounded-lg border bg-card ${last ? "" : "has-next"} ${m.winner ? "border-primary/60" : "border-border"}`}>
      {row(m.a, a, setA, m.scoreA)}
      <div className="border-t border-border/60" />
      {row(m.b, b, setB, m.scoreB)}
      {m.bye && <p className="px-2 pb-1 text-[10px] text-muted-foreground">Avança direto (BYE)</p>}
      {ready && (
        <div className="flex gap-1 border-t border-border/60 p-1.5">
          <Button size="sm" variant="arena" className="h-7 flex-1 text-xs" disabled={busy || a === "" || b === ""} onClick={() => submit()}>
            {m.winner ? "Corrigir vencedor" : "Confirmar vencedor"}
          </Button>
          {m.winner && <Button size="sm" variant="arenaOutline" className="h-7 text-xs" disabled={busy} onClick={() => submit(true)}>Limpar</Button>}
        </div>
      )}
    </div>
  );
}
