import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getOrderStatus, type PaymentStatus } from "@/lib/pagamento.functions";
import { PixPayment, STATUS_LABEL } from "@/components/PixPayment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/acompanhar")({
  validateSearch: z.object({ codigo: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Acompanhar inscrição | CNA FIFA COMPETITION" },
      { name: "description", content: "Consulte o status do pagamento da inscrição da sua dupla pelo código." },
      { property: "og:title", content: "Acompanhar inscrição | CNA FIFA COMPETITION" },
      { property: "og:description", content: "Consulte o status do pagamento da sua dupla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Acompanhar,
});

type Result = { code: string; status: PaymentStatus; refusalReason: string | null };

function Acompanhar() {
  const { codigo } = Route.useSearch();
  const lookup = useServerFn(getOrderStatus);
  const [code, setCode] = useState(codigo ?? "");
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setError(""); setRes(null); setBusy(true);
    try {
      const r = await lookup({ data: { code } });
      if (!r.found) setError("Nenhuma inscrição encontrada com esse código.");
      else setRes(r);
    } catch (err) { setError(err instanceof Error ? err.message : "Algo deu errado."); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display text-3xl leading-tight text-foreground">ACOMPANHAR INSCRIÇÃO</h1>
        <p className="mt-2 text-sm text-muted-foreground">Digite o código recebido ao se inscrever (ex.: PED-00012).</p>
        <form onSubmit={search} className="mt-6 flex gap-2">
          <Input aria-label="Código da inscrição" value={code} onChange={(e) => setCode(e.target.value)} placeholder="PED-00012" />
          <Button type="submit" variant="arena" disabled={busy}>{busy ? "…" : "Consultar"}</Button>
        </form>
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        {res && (
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Status de {res.code}</p>
              <p className={`font-display text-2xl ${res.status === "confirmado" ? "text-info" : res.status === "recusado" ? "text-destructive" : "text-foreground"}`}>{STATUS_LABEL[res.status]}</p>
              {res.status === "recusado" && res.refusalReason && <p className="mt-1 text-sm text-foreground">Motivo: {res.refusalReason}</p>}
            </div>
            {(res.status === "aguardando_pagamento" || res.status === "recusado") && <PixPayment code={res.code} onDone={() => setRes({ ...res, status: "aguardando_confirmacao" })} />}
          </div>
        )}
        <a href="/" className="mt-8 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline">Voltar para a página do evento</a>
      </div>
    </div>
  );
}
