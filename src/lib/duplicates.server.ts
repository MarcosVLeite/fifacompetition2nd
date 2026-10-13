// Server-only: asks the Lovable AI Gateway (Responses API, streamed) to find
// likely duplicate team registrations.
export interface DupInput {
  id: string;
  player1Name: string;
  player2Name: string;
  phone: string;
  createdAt: string;
}
export interface DupMatch {
  duplicateId: string;
  originalId: string;
  explanation: string;
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["matches"],
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["duplicateId", "originalId", "explanation"],
        properties: {
          duplicateId: { type: "string" },
          originalId: { type: "string" },
          explanation: { type: "string" },
        },
      },
    },
  },
};

export class GatewayError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function detectDuplicates(rows: DupInput[]): Promise<DupMatch[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new GatewayError(401, "Chave de IA não configurada.");
  if (rows.length < 2) return [];

  const instructions =
    "Você analisa inscrições de duplas de um campeonato. Identifique inscrições prováveis de serem duplicadas: " +
    "mesma dupla com nomes escritos de forma parecida (acentos, abreviações, erros de digitação, ordem trocada dos jogadores) " +
    "e/ou telefones iguais ou quase iguais (mesmos dígitos com formatação diferente, DDD/+55 a mais). " +
    "Para cada duplicada, originalId é a inscrição mais antiga (createdAt) e duplicateId a mais recente. " +
    "Não marque como duplicadas duplas apenas com um nome comum em comum sem outro indício. " +
    "Escreva explanation em português, curta, citando os nomes/telefones que coincidem. Use apenas IDs fornecidos.";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions,
      input: [{ role: "user", content: JSON.stringify(rows) }],
      text: { format: { type: "json_schema", name: "duplicates", strict: true, schema } },
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    console.error("AI gateway error", res.status, body);
    const msg =
      res.status === 402
        ? "Créditos de IA esgotados. Adicione créditos ao workspace para continuar."
        : res.status === 429
          ? "Muitas solicitações à IA. Tente novamente em instantes."
          : res.status === 403
            ? "Acesso à IA bloqueado para este workspace."
            : "A análise por IA falhou. Tente novamente.";
    throw new GatewayError(res.status, msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let refused = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() ?? "";
    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
          else if (ev.type === "response.refusal.delta") refused = true;
          else if (ev.type === "response.failed" || ev.type === "error") {
            throw new GatewayError(500, "A análise por IA falhou. Tente novamente.");
          }
        } catch (e) {
          if (e instanceof GatewayError) throw e;
        }
      }
    }
  }
  if (refused || !text) throw new GatewayError(500, "A IA não retornou uma análise.");

  const parsed = JSON.parse(text) as { matches: DupMatch[] };
  const ids = new Set(rows.map((r) => r.id));
  const seen = new Set<string>();
  return parsed.matches.filter((m) => {
    if (!ids.has(m.duplicateId) || !ids.has(m.originalId) || m.duplicateId === m.originalId) return false;
    if (seen.has(m.duplicateId)) return false;
    seen.add(m.duplicateId);
    return true;
  });
}
