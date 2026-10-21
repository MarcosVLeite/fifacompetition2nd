import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDown, ArrowUpRight, CalendarDays, Clock3, Gamepad2, MapPin, Plus, Users, Ticket, Check, Loader2, Trophy, Medal } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { formatPhone } from "@/lib/utils";
import { createRegistration } from "@/lib/pagamento.functions";
import { PixPayment } from "@/components/PixPayment";
import heroAsset from "@/assets/monstros-futebol.png.asset.json";
import cnaTrofeu from "@/assets/cna-trofeu.png.asset.json";

const description = "Monte sua dupla para o CNA FIFA COMPETITION em Itapecerica da Serra: 05 de dezembro, 14h. Inscrição R$ 20. Prêmios: R$ 150 para a dupla campeã e descontos no curso.";
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "CNA FIFA COMPETITION — Entre em campo com sua dupla" },
    { name: "description", content: description },
    { property: "og:title", content: "CNA FIFA COMPETITION | CNA Itapecerica da Serra" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

const registrationSchema = z.object({
  player1: z.string().trim().min(3, "Informe o nome completo do jogador 1").max(100, "Nome muito longo"),
  player2: z.string().trim().min(3, "Informe o nome completo do jogador 2").max(100, "Nome muito longo"),
  phone: z.string().trim().regex(/^[\d\s()+-]{8,20}$/, "Informe um telefone válido com DDD"),
  isCnaStudent: z.enum(["sim", "nao"], { message: "Selecione uma opção" }),
});

type RegistrationForm = { player1: string; player2: string; phone: string; isCnaStudent: "" | "sim" | "nao" };
const emptyForm: RegistrationForm = { player1: "", player2: "", phone: "", isCnaStudent: "" };

function Index() {
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [form, setForm] = useState<RegistrationForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [order, setOrder] = useState<{ code: string; phone: string } | null>(null);
  const createReg = useServerFn(createRegistration);

  const openRegistration = () => { setRegistrationOpen(true); setSubmitted(false); setSubmitError(""); };
  const viewEvent = () => document.getElementById("campeonato")?.scrollIntoView({ behavior: "smooth" });
  const setField = (field: keyof RegistrationForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submitRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError("");
    const parsed = registrationSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof RegistrationForm, string>> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as keyof RegistrationForm] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      const { code } = await createReg({ data: {
        player1: parsed.data.player1,
        player2: parsed.data.player2,
        phone: parsed.data.phone,
        isCnaStudent: parsed.data.isCnaStudent === "sim",
      } });
      setOrder({ code, phone: parsed.data.phone });
      setSubmitted(true);
      setForm(emptyForm);
    } catch {
      setSubmitError("Não foi possível enviar sua inscrição. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="site-wrap site-header">
        <div className="flex items-center gap-3" aria-label="CNA FIFA COMPETITION">
          <img src={cnaTrofeu.url} alt="CNA" width={1635} height={505} className="brand-logo" decoding="async" />
          <span className="event-wordmark"><span className="wm-cna">CNA </span>FIFA<br /><span className="text-muted-foreground">COMPETITION</span></span>
        </div>
        <div className="header-place flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={15} /> CNA Itapecerica da Serra</div>
        <Button variant="arenaOutline" onClick={openRegistration} className="h-10 px-5">Quero participar <ArrowUpRight /></Button>
      </header>

      <main>
        <section className="hero" aria-labelledby="event-title">
          <img src={heroAsset.url} alt="Monstros jogando videogame em uma sala iluminada por luzes neon" width={1672} height={941} className="hero-image" fetchPriority="high" />
          <div className="hero-stamp">05 DEZ<br /><span className="text-primary">14:00 H</span></div>
          <div className="site-wrap hero-content fade-in">
            <div className="hero-kicker eyebrow">O jogo é em dupla. A emoção é em dobro.</div>
            <h1 id="event-title" className="hero-title"><img src={cnaTrofeu.url} alt="CNA" width={1635} height={505} className="hero-logo" decoding="async" />FIFA<br /><span className="text-primary">COMPETITION</span></h1>
            <p className="hero-copy">Chame seu parceiro. Escolha seu time.<br />É hora de levar sua dupla ao <span className="text-info">próximo&nbsp;nível</span>.</p>
            <div className="hero-actions">
              <Button variant="arena" className="h-13 px-7 text-base" onClick={openRegistration}>Quero entrar em campo <ArrowUpRight size={19} /></Button>
              <Button variant="ghost" className="h-13 px-0 text-sm" onClick={viewEvent}>Conheça o campeonato <ArrowDown /></Button>
            </div>
            <div className="hero-footnote"><Users size={15} /> <span className="text-info">R$ 20 por dupla</span> <span className="mx-1">·</span> Evento presencial</div>
          </div>
        </section>

        <div className="site-wrap">
          <div className="event-strip" aria-label="Informações do evento">
            <div className="event-fact"><CalendarDays /><div><small>Marque na agenda</small><strong>05 de dezembro</strong></div></div>
            <div className="event-fact"><Clock3 /><div><small>Apito inicial</small><strong>14h <span className="text-muted-foreground font-normal">/ 2:00 p.m.</span></strong></div></div>
            <div className="event-fact"><MapPin /><div><small>Nosso campo</small><strong>CNA Itapecerica da Serra</strong></div></div>
            <div className="event-fact"><Ticket /><div><small>Inscrição</small><strong className="text-info">R$ 20 por dupla</strong></div></div>
          </div>

          <section id="campeonato" className="section scroll-mt-6">
            <div className="section-label eyebrow"><span>01 /</span> O campeonato</div>
            <div className="editorial-grid">
              <div><h2 className="section-title">DOIS JOGADORES.<br />UM SÓ <span className="text-primary">OBJETIVO.</span></h2><p className="section-copy mt-5 max-w-md">O futebol conecta. O FIFA coloca essa <span className="text-info">conexão</span> em jogo. A segunda edição da CNA FIFA Competition chega ao CNA Itapecerica da Serra para reunir quem ama uma boa disputa.</p><p className="section-copy mt-4 max-w-md">Aqui, ninguém entra em campo sozinho. <span className="text-info">Traga sua dupla</span> e venha viver cada passe, cada defesa e cada gol.</p></div>
              <div>
                <div className="format-row"><Users /><div><h3>Seu parceiro faz parte do jogo</h3><p>O campeonato é disputado em duplas. Escolha quem vai dividir o controle e a torcida com você.</p></div></div>
                <div className="format-row"><Gamepad2 /><div><h3>Do controle para a competição</h3><p>Uma disputa presencial de FIFA, com toda a energia de jogar lado a lado.</p></div></div>
                <div className="format-row"><Ticket /><div><h3>Uma inscrição, dois jogadores</h3><p>A taxa é de <span className="text-info">R$ 20 para a dupla inteira</span>. É só reunir seu parceiro e se preparar.</p></div></div>
              </div>
            </div>
          </section>
        </div>

        <section id="premiacao" className="site-wrap section scroll-mt-6">
          <div className="section-label eyebrow"><span>02 /</span> Premiação</div>
          <div className="prize-head">
            <h2 className="section-title">O PÓDIO TEM<br /><span className="text-primary">RECOMPENSA.</span></h2>
            <p className="section-copy mt-4 max-w-md">Valeu cada passe. As três melhores duplas sobem ao pódio e ainda contam com desconto no curso.</p>
          </div>
          <div className="prize-grid">
            <article className="prize-card prize-card--top">
              <div className="prize-rank eyebrow"><Trophy /> 1º lugar</div>
              <div className="prize-value">R$ 150<span className="prize-unit">para a dupla</span></div>
              <p className="prize-note">Dinheiro na mão para dividir com o parceiro — mais desconto no curso.</p>
            </article>
            <article className="prize-card">
              <div className="prize-rank eyebrow"><Medal /> 2º lugar</div>
              <div className="prize-value prize-value--soft">Desconto<span className="prize-unit">no curso</span></div>
              <p className="prize-note">Vice-campeões também sobem ao pódio.</p>
            </article>
            <article className="prize-card">
              <div className="prize-rank eyebrow"><Medal /> 3º lugar</div>
              <div className="prize-value prize-value--soft">Desconto<span className="prize-unit">no curso</span></div>
              <p className="prize-note">O terceiro lugar também é premiado.</p>
            </article>
          </div>
        </section>

        <section className="invitation">
          <div className="site-wrap invitation-inner"><div><div className="eyebrow mb-3">Sua próxima partida tem data marcada</div><h2>SUA DUPLA ESTÁ PRONTA?</h2><p>05 de dezembro · 14h · CNA Itapecerica da Serra</p></div><Button variant="arenaDark" onClick={openRegistration} className="h-13 px-7 text-base">Vamos para o jogo <ArrowUpRight /></Button></div>
        </section>

        <section className="site-wrap section">
          <div className="section-label eyebrow"><span>03 /</span> Antes do apito</div>
          <div className="faq-grid"><div><h2 className="section-title">TIRE SUAS<br /><span className="text-primary">DÚVIDAS.</span></h2><p className="section-copy mt-4">Tudo certo para entrar em campo.</p></div><div>
            {[
              ["Preciso participar em dupla?", "Sim! O campeonato será em duplas. Convide seu parceiro para participar com você."],
              ["Quanto custa a inscrição?", "A inscrição custa R$ 20 por dupla, e não por jogador."],
              ["Quando e onde vai acontecer?", "No dia 05 de dezembro, às 14h (2:00 p.m.), no CNA Itapecerica da Serra."],
              ["Em qual plataforma será jogado?", "As partidas serão disputadas no PlayStation."],
              ["Quanto tempo dura cada partida?", "Cada partida terá 6 minutos."],
              ["Tem premiação?", "Sim. O 1º lugar leva R$ 150 para a dupla, além de desconto no curso. O 2º e o 3º lugares também recebem desconto no curso."],
              ["Como faço para me inscrever?", "Clique em \"Quero participar\" e preencha o formulário com os dados da sua dupla."],
            ].map(([question, answer]) => <details className="faq-item" key={question}><summary>{question}<Plus /></summary><p>{answer}</p></details>)}
          </div></div>
        </section>
      </main>

      <footer className="site-wrap site-footer"><div className="flex items-center gap-2"><img src={cnaTrofeu.url} alt="CNA" className="footer-logo" decoding="async" /><span className="font-semibold text-foreground">CNA FIFA COMPETITION</span><span className="mx-2">/</span> CNA Itapecerica da Serra</div><span>Futebol no controle. Conexão fora dele. · <a href="/acompanhar" className="underline underline-offset-4">Acompanhar inscrição</a></span></footer>

      <Dialog open={registrationOpen} onOpenChange={setRegistrationOpen}>
        <DialogContent className="w-[calc(100%-32px)] max-w-md rounded-md">
          {submitted ? (
            <div className="max-h-[80vh] overflow-y-auto py-2 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={28} /></div>
              <DialogHeader><DialogTitle className="font-display text-2xl leading-tight">INSCRIÇÃO ENVIADA!</DialogTitle><DialogDescription className="pt-3 text-base">Agora pague via Pix para garantir a vaga. Guarde o código abaixo para acompanhar o status.</DialogDescription></DialogHeader>
              {order && <div className="mt-4"><PixPayment code={order.code} phone={order.phone} /></div>}
              <Button variant="arenaOutline" className="mt-4 h-12 w-full" onClick={() => setRegistrationOpen(false)}>Fechar</Button>
            </div>
          ) : (
            <>
              <div className="text-primary"><Users size={30} /></div>
              <DialogHeader><DialogTitle className="font-display text-2xl leading-tight">INSCREVA SUA DUPLA.</DialogTitle><DialogDescription className="pt-2 text-base">Preencha os dados abaixo para garantir a vaga da sua dupla. Inscrição: R$ 20 por dupla.</DialogDescription></DialogHeader>
              <form onSubmit={submitRegistration} className="space-y-4 pt-2" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="player1">Nome completo — Jogador 1</Label>
                  <Input id="player1" value={form.player1} onChange={(e) => setField("player1", e.target.value)} maxLength={100} autoComplete="name" />
                  {errors.player1 && <p className="text-sm text-destructive">{errors.player1}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="player2">Nome completo — Jogador 2</Label>
                  <Input id="player2" value={form.player2} onChange={(e) => setField("player2", e.target.value)} maxLength={100} autoComplete="off" />
                  {errors.player2 && <p className="text-sm text-destructive">{errors.player2}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone com DDD</Label>
                  <Input id="phone" type="tel" value={form.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} maxLength={15} placeholder="(11) 99999-9999" autoComplete="tel" />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                </div>
                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium">Vocês são alunos do CNA?</legend>
                  <div className="flex gap-3 pt-1">
                    {(["sim", "nao"] as const).map((option) => (
                      <label key={option} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${form.isCnaStudent === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                        <input type="radio" name="isCnaStudent" value={option} checked={form.isCnaStudent === option} onChange={() => setField("isCnaStudent", option)} className="sr-only" />
                        {option === "sim" ? "Sim" : "Não"}
                      </label>
                    ))}
                  </div>
                  {errors.isCnaStudent && <p className="text-sm text-destructive">{errors.isCnaStudent}</p>}
                </fieldset>
                {submitError && <p className="text-sm text-destructive">{submitError}</p>}
                <Button variant="arena" type="submit" className="h-12 w-full" disabled={submitting}>
                  {submitting ? <><Loader2 className="animate-spin" /> Enviando...</> : <>Confirmar inscrição <ArrowUpRight /></>}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
