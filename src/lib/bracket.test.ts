import { describe, expect, it } from "vitest";
import { champion, clearResult, generateBracket, pendingCount, roundName, setResult } from "./bracket";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);

describe("bracket", () => {
  it("6 duplas: chave de 8 com 2 BYEs, nenhum BYE x BYE", () => {
    const b = generateBracket(ids(6));
    expect(b.rounds).toBe(3);
    const first = b.matches.filter((m) => m.round === 0);
    expect(first.filter((m) => m.bye)).toHaveLength(2);
    expect(first.every((m) => m.a || m.b)).toBe(true);
    const placed = first.flatMap((m) => [m.a, m.b]).filter(Boolean);
    expect(new Set(placed).size).toBe(6);
  });

  it("recusa duplas repetidas e menos de 2", () => {
    expect(() => generateBracket(["a", "a"])).toThrow();
    expect(() => generateBracket(["a"])).toThrow();
  });

  it("vencedor avança e empate é recusado", () => {
    let b = generateBracket(ids(4));
    expect(() => setResult(b, "r0-m0", 1, 1)).toThrow();
    b = setResult(b, "r0-m0", 3, 1);
    const w = b.matches.find((m) => m.id === "r0-m0")!.winner;
    expect(b.matches.find((m) => m.id === "r1-m0")!.a).toBe(w);
  });

  it("corrigir resultado reseta as fases seguintes", () => {
    let b = generateBracket(ids(4));
    b = setResult(b, "r0-m0", 2, 0);
    b = setResult(b, "r0-m1", 2, 0);
    b = setResult(b, "r1-m0", 1, 0);
    expect(champion(b)).not.toBeNull();
    b = setResult(b, "r0-m0", 0, 2);
    expect(champion(b)).toBeNull();
    expect(pendingCount(b)).toBe(1);
    b = clearResult(b, "r0-m1");
    expect(b.matches.find((m) => m.id === "r1-m0")!.b).toBeNull();
  });

  it("nomes das fases", () => {
    expect(roundName(0, 4)).toBe("Oitavas de final");
    expect(roundName(3, 4)).toBe("Final");
  });
});
