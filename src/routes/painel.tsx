import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getTeamRegistrations, lockPainel, type TeamRegistrationRow } from "@/lib/painel.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/painel")({
  loader: () => getTeamRegistrations(),
  head: () => ({
    meta: [
      { title: "Duplas inscritas | CNA FIFA COMPETITION" },
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
  const header = ["Data da inscrição", "Jogador 1", "Jogador 2", "Telefone", "Alunos do CNA"];
  const lines = rows.map((r) =>
    [
      formatDateTime(r.createdAt),
      r.player1Name,
      r.player2Name,
      r.phone,
      r.isCnaStudent ? "Sim" : "Não",
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

  async function handleLock() {
    await lock();
    await router.navigate({ to: "/entrar" });
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
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
          <div className="flex gap-2">
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
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{r.player1Name}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{r.player2Name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-foreground">{r.phone}</td>
                    <td className="px-4 py-3 text-foreground">{r.isCnaStudent ? "Sim" : "Não"}</td>
                  </tr>
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
