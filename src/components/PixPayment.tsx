import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimPayment } from "@/lib/pagamento.functions";
import { formatPhone } from "@/lib/utils";

export const PIX_KEY = "999999999";
export const PRICE = "R$ 20,00";

export const STATUS_LABEL: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  aguardando_confirmacao: "Aguardando confirmação",
  confirmado: "Confirmado",
  recusado: "Recusado",
};

export function PixPayment({ code, phone = "", onDone }: { code: string; phone?: string; onDone?: () => void }) {
  const claim = useServerFn(claimPayment);
  const [copied, setCopied] = useState("");
  const [tel, setTel] = useState(phone);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const copy = async (v: string, k: string) => {
    try { await navigator.clipboard.writeText(v); setCopied(k); setTimeout(() => setCopied(""), 2000); } catch { /* ignore */ }
  };

  async function submit() {
    setError("");
    if (file && file.size > 5 * 1024 * 1024) return setError("O comprovante deve ter no máximo 5 MB.");
    const fd = new FormData();
    fd.set("code", code);
    fd.set("phone", tel);
    if (file) fd.set("file", file);
    setBusy(true);
    try { await claim({ data: fd }); setDone(true); onDone?.(); }
    catch (e) { setError(e instanceof Error ? e.message : "Algo deu errado."); }
    finally { setBusy(false); }
  }

  if (done) return (
    <div className="rounded-md border border-border bg-card p-4 text-left text-sm">
      <p className="font-semibold text-foreground">Recebemos seu aviso! Status: Aguardando confirmação.</p>
      <p className="mt-1 text-muted-foreground">Acompanhe em <a className="underline" href={`/acompanhar?codigo=${code}`}>Acompanhar inscrição</a> com o código <b>{code}</b>.</p>
    </div>
  );

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4 text-left text-sm">
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-muted-foreground">Código da inscrição</p><p className="font-display text-xl text-foreground">{code}</p></div>
        <Button size="sm" variant="arenaOutline" onClick={() => copy(code, "code")}>{copied === "code" ? "Copiado!" : "Copiar"}</Button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-muted-foreground">Chave Pix · valor <span className="text-info">{PRICE}</span></p><p className="font-display text-xl text-foreground">{PIX_KEY}</p></div>
        <Button size="sm" variant="arena" onClick={() => copy(PIX_KEY, "pix")}>{copied === "pix" ? "Copiada!" : "Copiar chave"}</Button>
      </div>
      <p className="text-muted-foreground">Se possível, coloque o código <b className="text-foreground">{code}</b> na descrição do Pix.</p>
      <div className="space-y-1.5"><Label htmlFor="pay-phone">Telefone da inscrição</Label><Input id="pay-phone" type="tel" value={tel} onChange={(e) => setTel(formatPhone(e.target.value))} maxLength={15} placeholder="(11) 99999-9999" /></div>
      <div className="space-y-1.5"><Label htmlFor="pay-file">Comprovante (opcional, imagem ou PDF até 5 MB)</Label>
        <Input id="pay-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
      {error && <p className="text-destructive" role="alert">{error}</p>}
      <Button variant="arena" className="h-11 w-full" disabled={busy} onClick={submit}>{busy ? "Enviando…" : "Já paguei"}</Button>
    </div>
  );
}
