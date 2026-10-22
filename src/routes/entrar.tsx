import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { unlockPainel } from "@/lib/painel.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Acesso do organizador | CNA FIFA COMPETITION" },
      { name: "description", content: "Área restrita do organizador do campeonato." },
      { property: "og:title", content: "Acesso do organizador | CNA FIFA COMPETITION" },
      { property: "og:description", content: "Área restrita do organizador do CNA FIFA COMPETITION." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Unlock,
});

function Unlock() {
  const router = useRouter();
  const unlock = useServerFn(unlockPainel);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const password = new FormData(e.currentTarget).get("password") as string;
    const { ok } = await unlock({ data: { password } });
    if (ok) {
      await router.navigate({ to: "/painel" });
    } else {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg"
      >
        <h1 className="font-display text-2xl leading-tight text-foreground">
          PAINEL DO ORGANIZADOR
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Digite a senha para ver as duplas inscritas na CNA FIFA COMPETITION.
        </p>
        <label className="mt-6 block text-sm font-medium text-foreground" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-primary"
        />
        {error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            Senha incorreta. Tente novamente.
          </p>
        )}
        <Button type="submit" variant="arena" className="mt-5 w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
        <a
          href="/"
          className="mt-4 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Voltar para a página do evento
        </a>
      </form>
    </div>
  );
}
