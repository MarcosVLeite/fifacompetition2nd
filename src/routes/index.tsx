import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDown, ArrowUpRight, CalendarDays, Clock3, Gamepad2, MapPin, Plus, Trophy, Users, Ticket, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import arenaImage from "@/assets/fifa-arena.jpg";

const description = "Monte sua dupla para o 2nd FIFA Competition no CNA Itapecerica da Serra. Dia 05 de dezembro, às 14h. Inscrição: R$ 20 por dupla.";
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "2nd FIFA Competition — Entre em campo com sua dupla" },
    { name: "description", content: description },
    { property: "og:title", content: "2nd FIFA Competition | CNA Itapecerica da Serra" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

function Index() {
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const openRegistration = () => setRegistrationOpen(true);
  const viewEvent = () => document.getElementById("campeonato")?.scrollIntoView({ behavior: "smooth" });
  const copyDetails = async () => {
    const text = "2nd FIFA Competition\n05 de dezembro, às 14h (2:00 p.m.)\nCNA Itapecerica da Serra\nCampeonato em duplas · R$ 20 por dupla";
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <>
      <header className="site-wrap site-header">
        <div className="flex items-center gap-3" aria-label="2nd FIFA Competition">
          <span className="brand-icon"><Trophy size={25} strokeWidth={2} /></span>
          <span className="event-wordmark">FIFA<br /><span className="text-muted-foreground">COMPETITION</span></span>
        </div>
        <div className="header-place flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={15} /> CNA Itapecerica da Serra</div>
        <Button variant="arenaOutline" onClick={openRegistration} className="h-10 px-5">Quero participar <ArrowUpRight /></Button>
      </header>

      <main>
        <section className="hero" aria-labelledby="event-title">
          <img src={arenaImage} alt="Bola de futebol no gramado de um estádio iluminado à noite" width={1536} height={1024} className="hero-image" fetchPriority="high" />
          <div className="hero-stamp">05 DEZ<br /><span className="text-primary">14:00 H</span></div>
          <div className="site-wrap hero-content fade-in">
            <div className="hero-kicker eyebrow">O jogo é em dupla. A emoção é em dobro.</div>
            <h1 id="event-title" className="hero-title"><span className="edition">2nd</span>FIFA<br /><span className="text-primary">COMPETITION</span></h1>
            <p className="hero-copy">Chame seu parceiro. Escolha seu time.<br />É hora de levar sua dupla ao próximo nível.</p>
            <div className="hero-actions">
              <Button variant="arena" className="h-13 px-7 text-base" onClick={openRegistration}>Quero entrar em campo <ArrowUpRight size={19} /></Button>
              <Button variant="ghost" className="h-13 px-0 text-sm" onClick={viewEvent}>Conheça o campeonato <ArrowDown /></Button>
            </div>
            <div className="hero-footnote"><Users size={15} /> R$ 20 por dupla <span className="mx-1">·</span> Evento presencial</div>
          </div>
        </section>

        <div className="site-wrap">
          <div className="event-strip" aria-label="Informações do evento">
            <div className="event-fact"><CalendarDays /><div><small>Marque na agenda</small><strong>05 de dezembro</strong></div></div>
            <div className="event-fact"><Clock3 /><div><small>Apito inicial</small><strong>14h <span className="text-muted-foreground font-normal">/ 2:00 p.m.</span></strong></div></div>
            <div className="event-fact"><MapPin /><div><small>Nosso campo</small><strong>CNA Itapecerica da Serra</strong></div></div>
            <div className="event-fact"><Ticket /><div><small>Inscrição</small><strong>R$ 20 por dupla</strong></div></div>
          </div>

          <section id="campeonato" className="section scroll-mt-6">
            <div className="section-label eyebrow"><span>01 /</span> O campeonato</div>
            <div className="editorial-grid">
              <div><h2 className="section-title">DOIS JOGADORES.<br />UM SÓ <span className="text-primary">OBJETIVO.</span></h2><p className="section-copy mt-5 max-w-md">O futebol conecta. O FIFA coloca essa conexão em jogo. A segunda edição da FIFA Competition chega ao CNA Itapecerica da Serra para reunir quem ama uma boa disputa.</p><p className="section-copy mt-4 max-w-md">Aqui, ninguém entra em campo sozinho. Traga sua dupla e venha viver cada passe, cada defesa e cada gol.</p></div>
              <div>
                <div className="format-row"><Users /><div><h3>Seu parceiro faz parte do jogo</h3><p>O campeonato é disputado em duplas. Escolha quem vai dividir o controle e a torcida com você.</p></div></div>
                <div className="format-row"><Gamepad2 /><div><h3>Do controle para a competição</h3><p>Uma disputa presencial de FIFA, com toda a energia de jogar lado a lado.</p></div></div>
                <div className="format-row"><Ticket /><div><h3>Uma inscrição, dois jogadores</h3><p>A taxa é de R$ 20 para a dupla inteira. É só reunir seu parceiro e se preparar.</p></div></div>
              </div>
            </div>
          </section>
        </div>

        <section className="invitation">
          <div className="site-wrap invitation-inner"><div><div className="eyebrow mb-3">Sua próxima partida tem data marcada</div><h2>SUA DUPLA ESTÁ PRONTA?</h2><p>05 de dezembro · 14h · CNA Itapecerica da Serra</p></div><Button variant="arenaDark" onClick={openRegistration} className="h-13 px-7 text-base">Vamos para o jogo <ArrowUpRight /></Button></div>
        </section>

        <section className="site-wrap section">
          <div className="section-label eyebrow"><span>02 /</span> Antes do apito</div>
          <div className="faq-grid"><div><h2 className="section-title">TIRE SUAS<br /><span className="text-primary">DÚVIDAS.</span></h2><p className="section-copy mt-4">Tudo certo para entrar em campo.</p></div><div>
            {[
              ["Preciso participar em dupla?", "Sim! O campeonato será em duplas. Convide seu parceiro para participar com você."],
              ["Quanto custa a inscrição?", "A inscrição custa R$ 20 por dupla, e não por jogador."],
              ["Quando e onde vai acontecer?", "No dia 05 de dezembro, às 14h (2:00 p.m.), no CNA Itapecerica da Serra."],
              ["Como faço para me inscrever?", "Procure a equipe do CNA Itapecerica da Serra para confirmar os detalhes e realizar a inscrição da sua dupla."],
            ].map(([question, answer]) => <details className="faq-item" key={question}><summary>{question}<Plus /></summary><p>{answer}</p></details>)}
          </div></div>
        </section>
      </main>

      <footer className="site-wrap site-footer"><div className="flex items-center gap-2"><Trophy size={17} className="text-primary" /><span className="font-semibold text-foreground">2nd FIFA Competition</span><span className="mx-2">/</span> CNA Itapecerica da Serra</div><span>Futebol no controle. Conexão fora dele.</span></footer>
      <Dialog open={registrationOpen} onOpenChange={setRegistrationOpen}>
        <DialogContent className="w-[calc(100%-32px)] max-w-md rounded-md">
          <div className="text-primary"><Users size={30} /></div>
          <DialogHeader><DialogTitle className="font-display text-2xl leading-tight">ENTRE EM CAMPO<br />COM SUA DUPLA.</DialogTitle><DialogDescription className="pt-3 text-base">Para se inscrever, fale com a equipe do CNA Itapecerica da Serra e confirme a participação dos dois jogadores.</DialogDescription></DialogHeader>
          <div className="space-y-3 border-y border-border py-5 text-sm"><p className="flex items-center gap-3"><CalendarDays size={17} className="text-primary" />05 de dezembro · 14h (2:00 p.m.)</p><p className="flex items-center gap-3"><MapPin size={17} className="text-primary" />CNA Itapecerica da Serra</p><p className="flex items-center gap-3"><Ticket size={17} className="text-primary" /><strong>R$ 20 por dupla</strong></p></div>
          <Button variant="arena" className="h-12" onClick={copyDetails}>{copied ? <><Check /> Informações copiadas</> : <>Copiar informações do evento <ArrowUpRight /></>}</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
