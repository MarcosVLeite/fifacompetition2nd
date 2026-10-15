import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PaymentStatus = "aguardando_pagamento" | "aguardando_confirmacao" | "confirmado" | "recusado";

const codeRe = /^PED-\d{5,}$/;
const digits = (s: string) => s.replace(/\D/g, "");

const registrationSchema = z.object({
  player1: z.string().trim().min(3).max(100),
  player2: z.string().trim().min(3).max(100),
  phone: z.string().trim().refine((p) => digits(p).length >= 10 && digits(p).length <= 13),
  isCnaStudent: z.boolean(),
});

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export const createRegistration = createServerFn({ method: "POST" })
  .inputValidator((d) => registrationSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("team_registrations")
      .insert({ player1_name: data.player1, player2_name: data.player2, phone: data.phone, is_cna_student: data.isCnaStudent })
      .select("order_code")
      .single();
    if (error || !row?.order_code) throw new Error("Não foi possível enviar sua inscrição. Tente novamente.");
    return { code: row.order_code };
  });

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX = 5 * 1024 * 1024;

export const claimPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Dados inválidos.");
    const code = String(d.get("code") ?? "").trim().toUpperCase();
    const phone = String(d.get("phone") ?? "");
    const file = d.get("file");
    if (!codeRe.test(code)) throw new Error("Código inválido.");
    if (digits(phone).length < 10) throw new Error("Informe o telefone usado na inscrição.");
    let f: File | null = null;
    if (file instanceof File && file.size > 0) {
      if (!ALLOWED.includes(file.type)) throw new Error("Envie uma imagem (JPG, PNG, WEBP) ou PDF.");
      if (file.size > MAX) throw new Error("O comprovante deve ter no máximo 5 MB.");
      f = file;
    }
    return { code, phone, file: f };
  })
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db
      .from("team_registrations")
      .select("id, phone, payment_status")
      .eq("order_code", data.code)
      .maybeSingle();
    if (!row || digits(row.phone) !== digits(data.phone)) throw new Error("Código ou telefone não conferem.");
    if (row.payment_status === "confirmado") throw new Error("Este pagamento já foi confirmado.");
    let receipt_path: string | undefined;
    if (data.file) {
      const ext = data.file.type === "application/pdf" ? "pdf" : data.file.type.split("/")[1];
      receipt_path = `${row.id}/${Date.now()}.${ext}`;
      const { error } = await db.storage.from("comprovantes").upload(receipt_path, data.file, { contentType: data.file.type });
      if (error) throw new Error("Não foi possível enviar o comprovante.");
    }
    await db
      .from("team_registrations")
      .update({
        payment_status: "aguardando_confirmacao",
        paid_claimed_at: new Date().toISOString(),
        refusal_reason: null,
        decided_at: null,
        ...(receipt_path ? { receipt_path } : {}),
      })
      .eq("id", row.id);
    return { ok: true as const };
  });

export const getOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => {
    const code = String(d?.code ?? "").trim().toUpperCase();
    if (!codeRe.test(code)) throw new Error("Código inválido. Ex.: PED-00012");
    return { code };
  })
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row } = await db
      .from("team_registrations")
      .select("order_code, payment_status, refusal_reason, decided_at")
      .eq("order_code", data.code)
      .maybeSingle();
    if (!row) return { found: false as const };
    return {
      found: true as const,
      code: row.order_code!,
      status: row.payment_status as PaymentStatus,
      refusalReason: row.refusal_reason,
      decidedAt: row.decided_at,
    };
  });
