// Pure single-elimination engine (no I/O) — shared by server functions and UI.
export interface Match {
  id: string; // "r{round}-m{slot}"
  round: number; // 0 = first round
  slot: number;
  a: string | null;
  b: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: string | null;
  bye: boolean;
}
export interface Bracket {
  rounds: number;
  matches: Match[];
}

function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateBracket(ids: string[], rng: () => number = Math.random): Bracket {
  if (new Set(ids).size !== ids.length) throw new Error("Há duplas repetidas na seleção.");
  if (ids.length < 2) throw new Error("Selecione pelo menos 2 duplas.");
  const drawn = shuffle(ids, rng);
  let size = 2;
  while (size < drawn.length) size *= 2;
  const rounds = Math.log2(size);
  // Higher seed numbers beyond the field are BYEs; standard seeding spreads them
  // so no first-round match is BYE vs BYE.
  const positions = seedOrder(size).map((s) => (s <= drawn.length ? drawn[s - 1] : null));
  const matches: Match[] = [];
  for (let r = 0; r < rounds; r++) {
    const count = size / 2 ** (r + 1);
    for (let s = 0; s < count; s++) {
      const a = r === 0 ? positions[2 * s] : null;
      const b = r === 0 ? positions[2 * s + 1] : null;
      const bye = r === 0 && (a === null || b === null);
      matches.push({ id: `r${r}-m${s}`, round: r, slot: s, a, b, scoreA: null, scoreB: null, winner: bye ? (a ?? b) : null, bye });
    }
  }
  return propagate({ rounds, matches });
}

function find(b: Bracket, round: number, slot: number) {
  return b.matches.find((m) => m.round === round && m.slot === slot);
}

/** Re-derive later rounds from earlier winners; any match whose players changed is reset. */
export function propagate(bracket: Bracket): Bracket {
  const b: Bracket = { rounds: bracket.rounds, matches: bracket.matches.map((m) => ({ ...m })) };
  for (let r = 1; r < b.rounds; r++) {
    for (const m of b.matches.filter((x) => x.round === r)) {
      const a = find(b, r - 1, 2 * m.slot)?.winner ?? null;
      const bb = find(b, r - 1, 2 * m.slot + 1)?.winner ?? null;
      if (a !== m.a || bb !== m.b) {
        m.a = a; m.b = bb; m.scoreA = null; m.scoreB = null; m.winner = null;
      }
    }
  }
  return b;
}

export function setResult(bracket: Bracket, matchId: string, scoreA: number, scoreB: number): Bracket {
  const m = bracket.matches.find((x) => x.id === matchId);
  if (!m) throw new Error("Partida não encontrada.");
  if (m.bye) throw new Error("Esta vaga é um BYE — o avanço é automático.");
  if (!m.a || !m.b) throw new Error("A partida ainda não tem as duas duplas definidas.");
  for (const s of [scoreA, scoreB]) if (!Number.isInteger(s) || s < 0 || s > 99) throw new Error("Placar inválido.");
  if (scoreA === scoreB) throw new Error("Mata-mata não tem empate: informe o placar final com um vencedor (inclua os pênaltis).");
  const next = { rounds: bracket.rounds, matches: bracket.matches.map((x) => x.id === matchId ? { ...x, scoreA, scoreB, winner: scoreA > scoreB ? x.a : x.b } : x) };
  return propagate(next);
}

export function clearResult(bracket: Bracket, matchId: string): Bracket {
  const m = bracket.matches.find((x) => x.id === matchId);
  if (!m || m.bye) throw new Error("Partida inválida.");
  return propagate({ rounds: bracket.rounds, matches: bracket.matches.map((x) => x.id === matchId ? { ...x, scoreA: null, scoreB: null, winner: null } : x) });
}

export function isStarted(b: Bracket) {
  return b.matches.some((m) => !m.bye && m.winner);
}
export function pendingCount(b: Bracket) {
  return b.matches.filter((m) => !m.winner).length;
}
export function champion(b: Bracket): string | null {
  return b.matches.find((m) => m.round === b.rounds - 1)?.winner ?? null;
}

export function roundName(round: number, rounds: number): string {
  const fromEnd = rounds - 1 - round;
  return ["Final", "Semifinal", "Quartas de final", "Oitavas de final"][fromEnd] ?? `${round + 1}ª fase`;
}
