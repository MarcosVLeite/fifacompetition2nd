import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteTeamRegistration,
  detectAndBlockDuplicates,
  getTeamRegistrations,
  lockPainel,
  unblockTeamRegistration,
  updateTeamRegistration,
  setPaymentStatus,
  getReceiptUrl,
  type TeamRegistrationRow,
} from "@/lib/painel.functions";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full min-w-28 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function RegistrationRow({ row }: { row: TeamRegistrationRow }) {
  const router = useRouter();
  const update = useServerFn(updateTeamRegistration);
  const remove = useServerFn(deleteTeamRegistration);
  const unblock = useServerFn(unblockTeamRegistration);
  const setPay = useServerFn(setPaymentStatus);
  const receipt = useServerFn(getReceiptUrl);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    player1Name: row.player1Name,
    player2Name: row.player2Name,
    phone: row.phone,
    isCnaStudent: row.isCnaStudent,
  });

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setEditing(false);
      await router.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setBusy(false);
    }
  }

  function handleRefuse() {
    const reason = window.prompt("Motivo da recusa:");
    if (!reason) return;
    void run(() => setPay({ data: { id: row.id, status: "recusado", reason } }));
  }

  async function openReceipt() {
    const w = window.open("", "_blank");
    try { const { url } = await receipt({ data: { id: row.id } }); if (w) w.location.href = url; }
    catch (e) { w?.close(); setError(e instanceof Error ? e.message : "Erro."); }
  }

  function handleDelete() {
    if (!window.confirm(`Apagar a inscrição de ${row.player1Name} e ${row.player2Name}?`)) return;
    void run(() => remove({ data: { id: row.id } }));
  }

  return (
    <tr className="border-b border-border/60 align-top last:border-0">
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {formatDateTime(row.createdAt)}
      </td>
      {editing ? (
        <>
          <td className="px-4 py-3">
            <input aria-label="Jogador 1" className={inputCls} value={form.player1Name}
              onChange={(e) => setForm({ ...form, player1Name: e.target.value })} />
          </td>
          <td className="px-4 py-3">
            <input aria-label="Jogador 2" className={inputCls} value={form.player2Name}
              onChange={(e) => setForm({ ...form, player2Name: e.target.value })} />
          </td>
          <td className="px-4 py-3">
            <input aria-label="Telefone" className={inputCls} value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </td>
          <td className="px-4 py-3">
            <select aria-label="Alunos do CNA" className={inputCls}
              value={form.isCnaStudent ? "sim" : "nao"}
              onChange={(e) => setForm({ ...form, isCnaStudent: e.target.value === "sim" })}>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </td>
        </>
      ) : (
        <>
          <td className="px-4 py-3 font-medium text-foreground">
            {row.player1Name}
            {row.isBlocked && (
              <div className="mt-2 max-w-xs rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs font-normal text-foreground">
                <span className="font-semibold text-destructive">BLOQUEADA · </span>
                {row.blockReason}
                <button className="ml-1 underline text-muted-foreground" disabled={busy}
                  onClick={() => run(() => unblock({ data: { id: row.id } }))}>
                  Desbloquear
                </button>
              </div>
            )}
          </td>
          <td className="px-4 py-3 font-medium text-foreground">{row.player2Name}</td>
          <td className="whitespace-nowrap px-4 py-3 text-foreground">{row.phone}</td>
          <td className="px-4 py-3 text-foreground">{row.isCnaStudent ? "Sim" : "Não"}</td>
        </>
      )}
      <td className="px-4 py-3 text-xs">
        <p className="font-display text-sm text-foreground">{row.orderCode}</p>
        <p className={row.paymentStatus === "confirmado" ? "text-info" : row.paymentStatus === "recusado" ? "text-destructive" : row.paymentStatus === "aguardando_confirmacao" ? "font-semibold text-primary" : "text-muted-foreground"}>
          {PAY_LABEL[row.paymentStatus] ?? row.paymentStatus}
        </p>
        {row.paidClaimedAt && <p className="text-muted-foreground">Aviso: {formatDateTime(row.paidClaimedAt)}</p>}
        {row.decidedAt && <p className="text-muted-foreground">Decisão: {formatDateTime(row.decidedAt)}</p>}
        {row.refusalReason && <p className="text-muted-foreground">Motivo: {row.refusalReason}</p>}
        {row.hasReceipt && <button className="underline text-foreground" onClick={openReceipt}>Ver comprovante</button>}
        {row.paymentStatus !== "confirmado" && (
          <div className="mt-1 flex gap-1">
            <Button size="sm" variant="arena" disabled={busy} onClick={() => run(() => setPay({ data: { id: row.id, status: "confirmado" } }))}>Confirmar</Button>
            {row.paymentStatus !== "recusado" && <Button size="sm" variant="arenaOutline" disabled={busy} onClick={handleRefuse}>Recusar</Button>}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="arena" disabled={busy}
                onClick={() => run(() => update({ data: { id: row.id, ...form } }))}>
                Salvar
              </Button>
              <Button size="sm" variant="arenaOutline" disabled={busy}
                onClick={() => { setEditing(false); setError(null); }}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="arenaOutline" disabled={busy} onClick={() => setEditing(true)}>
                Editar
              </Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={handleDelete}>
                Apagar
              </Button>
            </>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </td>
    </tr>
  );
}

const PAY_LABEL: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  aguardando_confirmacao: "Aguardando confirmação",
  confirmado: "Confirmado",
  recusado: "Recusado",
};

export const Route = createFileRoute("/painel")({
  loader: () => getTeamRegistrations(),
  head: () => ({
    meta: [
      { title: "Duplas inscritas | CNA FIFA COMPETITION" },
      { name: "description", content: "Lista de duplas inscritas no campeonato (acesso restrito)." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Painel,
});

function csvEscape(value: string): string {
  if (/[;"\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function buildCsv(rows: TeamRegistrationRow[]): string {
  const header = ["Código", "Pagamento", "Data da inscrição", "Jogador 1", "Jogador 2", "Telefone", "Alunos do CNA", "Status"];
  const lines = rows.map((r) =>
    [
      r.orderCode,
      PAY_LABEL[r.paymentStatus] ?? r.paymentStatus,
      formatDateTime(r.createdAt),
      r.player1Name,
      r.player2Name,
      r.phone,
      r.isCnaStudent ? "Sim" : "Não",
      r.isBlocked ? `Bloqueada: ${r.blockReason ?? ""}` : "Ativa",
    ]
      .map(csvEscape)
      .join(";"),
  );
  // BOM so Excel opens the file with the correct encoding
  return "\uFEFF" + [header.join(";"), ...lines].join("\r\n");
}

function downloadCsv(rows: TeamRegistrationRow[]) {
  const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "duplas-inscritas-cna-fifa-competition.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function Painel() {
  const { registrations } = Route.useLoaderData();
  const router = useRouter();
  const lock = useServerFn(lockPainel);
  const detect = useServerFn(detectAndBlockDuplicates);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const total = registrations.length;
  const blocked = registrations.filter((r) => r.isBlocked).length;
  const active = total - blocked;
  const cnaStudents = registrations.filter((r) => r.isCnaStudent).length;
  const cnaPercent = total === 0 ? 0 : Math.round((cnaStudents / total) * 100);
  const estimatedRevenue = active * 20;

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? registrations.filter((r) =>
        [r.player1Name, r.player2Name, r.phone, r.orderCode]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
      )
    : registrations;
  const shown = statusFilter === "todos" ? filtered : filtered.filter((r) => r.paymentStatus === statusFilter);
  const confirmed = registrations.filter((r) => r.paymentStatus === "confirmado").length;
  const pendingReview = registrations.filter((r) => r.paymentStatus === "aguardando_confirmacao").length;

  async function handleLock() {
    await lock();
    await router.navigate({ to: "/entrar" });
  }

  async function handleDetect() {
    setChecking(true);
    setNotice(null);
    try {
      const res = await detect();
      if (!res.ok) setNotice({ ok: false, text: res.error });
      else {
        setNotice({
          ok: true,
          text: res.blocked === 0
            ? "Nenhuma inscrição duplicada encontrada."
            : `${res.blocked} ${res.blocked === 1 ? "inscrição bloqueada" : "inscrições bloqueadas"} como possível duplicata.`,
        });
        await router.invalidate();
      }
    } catch {
      setNotice({ ok: false, text: "A análise por IA falhou. Tente novamente." });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl leading-tight text-foreground">
              DUPLAS INSCRITAS
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              CNA FIFA COMPETITION — {registrations.length}{" "}
              {registrations.length === 1 ? "dupla inscrita" : "duplas inscritas"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="arenaOutline"
              onClick={handleDetect}
              disabled={checking || registrations.length < 2}
            >
              {checking ? "Analisando…" : "Verificar duplicadas (IA)"}
            </Button>
            <Button
              variant="arena"
              onClick={() => downloadCsv(registrations)}
              disabled={registrations.length === 0}
            >
              Exportar CSV
            </Button>
            <Button variant="arenaOutline" onClick={handleLock}>
              Bloquear
            </Button>
          </div>
        </div>
        {notice && (
          <p className={`mt-4 text-sm ${notice.ok ? "text-foreground" : "text-destructive"}`}>
            {notice.text}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total de duplas</p>
            <p className="mt-1 font-display text-2xl text-foreground">{total}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Ativas / Bloqueadas</p>
            <p className="mt-1 font-display text-2xl text-foreground">
              {active} <span className="text-base text-muted-foreground">/</span>{" "}
              <span className={blocked > 0 ? "text-destructive" : ""}>{blocked}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Alunos do CNA</p>
            <p className="mt-1 font-display text-2xl text-foreground">
              {cnaPercent}%{" "}
              <span className="text-base text-muted-foreground">
                ({cnaStudents} de {total})
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Arrecadação estimada</p>
            <p className="mt-1 font-display text-2xl text-foreground">
              R$ {estimatedRevenue}
              <span className="text-base text-muted-foreground"> ({active} × R$ 20)</span>
            </p>
          </div>
        </div>

        {registrations.length > 0 && (
          <div className="mt-6">
            <input
              type="search"
              aria-label="Buscar dupla por nome ou telefone"
              placeholder="Buscar por nome, telefone ou código…"
              className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select aria-label="Filtrar por pagamento" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="ml-2 mt-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground sm:mt-0">
              <option value="todos">Todos os pagamentos</option>
              {Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <p className="mt-2 text-sm text-muted-foreground">
              {confirmed} pagamento(s) confirmado(s) · <span className={pendingReview ? "font-semibold text-primary" : ""}>{pendingReview} aguardando sua confirmação</span>
            </p>
          </div>
        )}

        {registrations.length === 0 ? (
          <p className="mt-10 rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            Nenhuma dupla inscrita ainda. As inscrições enviadas no site aparecem aqui.
          </p>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Data da inscrição</th>
                  <th className="px-4 py-3 font-medium">Jogador 1</th>
                  <th className="px-4 py-3 font-medium">Jogador 2</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Alunos do CNA</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <RegistrationRow key={r.id} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <a
          href="/"
          className="mt-8 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Voltar para a página do evento
        </a>
      </div>
    </div>
  );
}
