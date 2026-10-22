import { beforeEach, describe, expect, it, vi } from "vitest";
import { champion, generateBracket, setResult } from "./bracket";

const state = vi.hoisted(() => ({ unlocked: true, row: {} as Record<string, unknown>, eligible: true, conflict: false, patch: {} as Record<string, unknown>, reads: 0 }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (data: unknown): unknown => data;
  const builder = {
    inputValidator: (fn: typeof validate) => { validate = fn; return builder; },
    handler: (fn: (input: { data: unknown }) => unknown) => (input?: { data: unknown }) => fn({ data: validate(input?.data) }),
  };
  return builder;
} }));
vi.mock("@tanstack/react-start/server", () => ({ useSession: async () => ({ data: { unlocked: state.unlocked } }) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  state.reads++;
  let updating = false;
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    update: (patch: Record<string, unknown>) => { updating = true; state.patch = patch; return query; },
    maybeSingle: async () => ({ data: state.row, error: null }),
    then: (resolve: (value: unknown) => unknown) => resolve({ data: updating ? (state.conflict ? [] : [{ ...state.row, ...state.patch }]) : (table === "team_registrations" && state.eligible ? (state.row['participant_ids'] as string[]).map(id => ({ id })) : []), error: null }),
  };
  return query;
} } }));
import { restartTournament } from "./painel.functions";
const id = "11111111-1111-4111-8111-111111111111";
const participants = ["a", "b", "c", "d", "e", "f"];
const call = (confirmWipe = true) => restartTournament({ data: { id, version: 7, confirmWipe } });

beforeEach(() => {
  const initial = generateBracket(participants, () => 0.5);
  const started = setResult(initial, initial.matches.find(m => !m.bye)?.id ?? "", 3, 1);
  Object.assign(state, { unlocked: true, eligible: true, conflict: false, reads: 0, patch: {}, row: { id, name: "CNA", status: "finalizado", participant_ids: participants, bracket: started, version: 7, created_at: "2026-10-22" } });
});
describe("restartTournament", () => {
  it("requires explicit confirmation before deleting results", async () => {
    expect(() => call(false)).toThrow("Confirme");
    expect(state.reads).toBe(0);
  });
  it("requires the organizer gate before accessing data", async () => {
    state.unlocked = false;
    await expect(call()).rejects.toBeDefined();
    expect(state.reads).toBe(0);
  });
  it("keeps exactly the same six teams and clears scores, later rounds and champion", async () => {
    const result = await call();
    expect(result.participantIds).toEqual(participants);
    expect(result.name).toBe("CNA");
    expect(result.status).toBe("aguardando");
    expect(result.version).toBe(8);
    expect(result.bracket.matches.filter(m => m.round === 0).flatMap(m => [m.a, m.b]).filter(Boolean).sort()).toEqual([...participants].sort());
    expect(result.bracket.matches.every(m => m.scoreA === null && m.scoreB === null)).toBe(true);
    expect(result.bracket.matches.filter(m => !m.bye).every(m => m.winner === null)).toBe(true);
    expect(champion(result.bracket)).toBeNull();
    expect(result.bracket.matches.filter(m => m.bye)).toHaveLength(2);
  });
  it("does not silently remove blocked or deleted teams", async () => {
    state.eligible = false;
    await expect(call()).rejects.toThrow("bloqueada");
    expect(state.patch).toEqual({});
  });
  it("refuses to overwrite concurrent changes", async () => {
    state.conflict = true;
    await expect(call()).rejects.toThrow("Outro organizador");
  });
});
