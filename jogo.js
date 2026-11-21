// jogo.js — ilha-da-traicao
// Sobrevivência, Romance & Traição (versão web)

const VERSAO = "1.0.0";
const MAX_DIAS = 15;

const TRACOS = [
  "engraçado(a)", "misterioso(a)", "protetor(a)", "impulsivo(a)",
  "calmo(a)", "ciumento(a)", "observador(a)", "manipulador(a)", "leal"
];

// ---------- utilitários ----------
const aleatorio = arr => arr[Math.floor(Math.random() * arr.length)];
const aleatorioPonderado = (arr, pesos) => {
  const total = pesos.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= pesos[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
};

// ---------- Personagem ----------
class Personagem {
  constructor(nome, isPlayer = false) {
    this.nome = nome;
    this.isPlayer = isPlayer;
    this.afeto = 0;
    this.suspeita = 0;
    this.energia = 100;
    this.status = "vivo";
    this.tracos = isPlayer ? "protagonista" : aleatorio(TRACOS);
    this.traidor = false;
    this.parRomantico = null;
  }
}

// ---------- Estado global ----------
let estado = {};

function novoJogo(nomeJogador, nomesAmigos) {
  const jogador = new Personagem(nomeJogador, true);
  const personagens = [jogador, ...nomesAmigos.map(n => new Personagem(n))];

  const candidatos = personagens.filter(p => !p.isPlayer);
  const traidor = aleatorio(candidatos);
  traidor.traidor = true;
  traidor.tracos = "manipulador(a) e frio(a)";

  estado = {
    personagens,
    jogador,
    traidor,
    dia: 1,
    clima: "ensolarado",
    recursos: { comida: 15, agua: 15, abrigo: 5 },
    investigacao: 0,
    votacaoDisponivel: false,
    fim: false
  };
}

const vivos = () => estado.personagens.filter(p => p.status === "vivo");

function ajustarAfeto(a, b, qtd) {
  a.afeto = Math.max(0, Math.min(100, a.afeto + qtd));
  b.afeto = Math.max(0, Math.min(100, b.afeto + qtd));
}
function ajustarSuspeita(p, qtd) {
  p.suspeita = Math.max(0, Math.min(100, p.suspeita + qtd));
}
function ajustarRecurso(tipo, qtd) {
  estado.recursos[tipo] = Math.max(0, estado.recursos[tipo] + qtd);
}

// ---------- Eventos ----------
function eventoVida() {
  const p = aleatorio(vivos());
  const opcoes = [
    { txt: `🌿 ${p.nome} encontrou frutas na floresta (+3 comida).`, fn: () => ajustarRecurso("comida", 3) },
    { txt: `💧 ${p.nome} achou uma fonte de água limpa (+3 água).`, fn: () => ajustarRecurso("agua", 3) },
    { txt: `⛺ ${p.nome} reforçou o abrigo (+2 abrigo).`, fn: () => ajustarRecurso("abrigo", 2) },
    { txt: `🩸 ${p.nome} se machucou explorando (-20 energia).`, fn: () => { p.energia = Math.max(0, p.energia - 20); p.status = "ferido"; } },
    { txt: `🌪️ Uma tempestade destruiu parte do acampamento (-2 abrigo).`, fn: () => ajustarRecurso("abrigo", -2) }
  ];
  const ev = aleatorio(opcoes);
  ev.fn();
  return ev.txt;
}

function eventoRomance() {
  const cand = vivos().filter(p => !p.isPlayer);
  if (!cand.length) return null;
  const p = aleatorio(cand);
  const opcoes = [
    { txt: `💕 ${p.nome} e ${estado.jogador.nome} conversaram sob as estrelas.`, fn: () => ajustarAfeto(p, estado.jogador, 15) },
    { txt: `😳 ${p.nome} salvou ${estado.jogador.nome} de um perigo.`, fn: () => ajustarAfeto(p, estado.jogador, 20) },
    { txt: `💔 ${p.nome} evitou ${estado.jogador.nome} o dia todo.`, fn: () => ajustarAfeto(p, estado.jogador, -10) },
    { txt: `🤝 ${p.nome} confiou um segredo a ${estado.jogador.nome}.`, fn: () => ajustarAfeto(p, estado.jogador, 10) }
  ];
  const ev = aleatorio(opcoes);
  ev.fn();
  let extra = "";
  if (p.afeto >= 50 && !p.parRomantico) {
    p.parRomantico = estado.jogador.nome;
    extra = `\n💘 ${p.nome} e ${estado.jogador.nome} estão oficialmente juntos!`;
  }
  return { txt: ev.txt + extra, classe: "romance" };
}

function eventoConflito() {
  const cand = vivos();
  if (cand.length < 2) return null;
  const [a, b] = cand.sort(() => Math.random() - 0.5).slice(0, 2);
  const opcoes = [
    `⚡ ${a.nome} acusou ${b.nome} de roubar comida. Tensão no ar.`,
    `😤 ${a.nome} e ${b.nome} discutiram feio sobre liderança.`,
    `🔪 ${a.nome} foi visto(a) sussurrando com ${b.nome}...`,
    `👀 ${a.nome} desconfia que ${b.nome} está escondendo algo.`
  ];
  ajustarSuspeita(a, 5);
  ajustarSuspeita(b, 5);
  return { txt: aleatorio(opcoes), classe: "" };
}

function eventoInvestigacao() {
  const suspeitos = vivos().filter(p => !p.isPlayer);
  if (!suspeitos.length) return null;
  if (Math.random() < 0.6) {
    const alvo = estado.traidor.status !== "morto" ? estado.traidor : aleatorio(suspeitos);
    estado.investigacao++;
    ajustarSuspeita(alvo, 20);
    return { txt: `🔍 Você encontrou uma pista comprometedora perto de ${alvo.nome}.\nSuspeita aumentou. (Pistas: ${estado.investigacao})`, classe: "investigacao" };
  }
  const falso = aleatorio(suspeitos);
  ajustarSuspeita(falso, 15);
  return { txt: `🔍 Você achou algo suspeito perto de ${falso.nome}...\nMas pode ser pista falsa. (Pistas: ${estado.investigacao})`, classe: "investigacao" };
}

function eventoTraicao() {
  if (estado.traidor.status !== "vivo") return null;
  const vitimas = vivos().filter(p => p !== estado.traidor);
  if (!vitimas.length) return null;

  const pesos = vitimas.map(v => 1 + Math.floor(v.afeto / 20) + (v.isPlayer ? 3 : 0));
  const vitima = aleatorioPonderado(vitimas, pesos);

  let chance = 0.6 - estado.traidor.suspeita / 200 + (100 - vitima.energia) / 300;
  chance = Math.max(0.15, Math.min(0.9, chance));

  if (Math.random() < chance) {
    vitima.status = "morto";
    vitima.energia = 0;
    ajustarSuspeita(estado.traidor, 15);
    return { txt: `💀 ${vitima.nome} foi encontrado(a) morto(a) esta manhã.\nNinguém viu nada. O grupo está em pânico.`, classe: "morte" };
  }
  vitima.status = "ferido";
  vitima.energia = Math.max(10, vitima.energia - 30);
  ajustarSuspeita(estado.traidor, 25);
  ajustarAfeto(vitima, estado.jogador, 5);
  return { txt: `⚠️ ${vitima.nome} sofreu uma tentativa de assassinato!\nSobreviveu, mas está ferido(a).`, classe: "destaque" };
}

// ---------- Renderização ----------
function renderCabecalho() {
  document.getElementById("info-dia").textContent = `📅 Dia ${estado.dia}`;
  document.getElementById("info-clima").textContent = `☀️ ${estado.clima}`;
  document.getElementById("info-comida").textContent = `🍖 ${estado.recursos.comida.toFixed(1)}`;
  document.getElementById("info-agua").textContent = `💧 ${estado.recursos.agua.toFixed(1)}`;
  document.getElementById("info-abrigo").textContent = `⛺ ${estado.recursos.abrigo}`;
  document.getElementById("info-pistas").textContent = `🔍 ${estado.investigacao}`;
}

function renderStatus() {
  const painel = document.getElementById("painel-status");
  painel.innerHTML = "";
  estado.personagens.forEach(p => {
    if (p.status === "morto") return;
    const emoji = p.energia > 60 ? "💚" : p.energia > 30 ? "💛" : "❤️";
    const div = document.createElement("div");
    div.className = "cartao-personagem" + (p.isPlayer ? " jogador" : "");
    div.innerHTML = `
      <strong>${emoji} ${p.nome}${p.isPlayer ? " (VOCÊ)" : ""}</strong><br>
      ${p.status} • Afeto: ${p.afeto} • Suspeita: ${p.suspeita}
      ${p.parRomantico ? `<br>💘 Par: ${p.parRomantico}` : ""}
    `;
    painel.appendChild(div);
  });
}

function logar(msg, classe = "") {
  const log = document.getElementById("log");
  const p = document.createElement("p");
  if (classe) p.className = classe;
  p.textContent = msg;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}

function limparLog() {
  document.getElementById("log").innerHTML = "";
}

// ---------- Turno ----------
function passarDia() {
  if (estado.fim) return;

  logar(`──────── DIA ${estado.dia} • ${estado.clima} ────────`, "destaque");

  const numEventos = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numEventos; i++) {
    const tipo = aleatorioPonderado(
      ["vida", "romance", "conflito", "investigacao"],
      [40, 30, 20, 10]
    );
    let ev;
    if (tipo === "vida") ev = { txt: eventoVida(), classe: "" };
    if (tipo === "romance") ev = eventoRomance();
    if (tipo === "conflito") ev = eventoConflito();
    if (tipo === "investigacao") ev = eventoInvestigacao();
    if (ev) logar(ev.txt, ev.classe);
  }

  // Traidor age a partir do dia 2
  if (estado.dia >= 2 && estado.traidor.status === "vivo") {
    if (Math.random() < 0.3 + estado.dia * 0.05) {
      const ev = eventoTraicao();
      if (ev) logar(ev.txt, ev.classe);
    }
  }

  // Consumo
  const v = vivos();
  estado.recursos.comida = Math.max(0, estado.recursos.comida - v.length * 0.4);
  estado.recursos.agua = Math.max(0, estado.recursos.agua - v.length * 0.4);

  if (estado.recursos.comida <= 0 || estado.recursos.agua <= 0) {
    const vitima = aleatorio(v);
    if (vitima) {
      vitima.energia = Math.max(0, vitima.energia - 20);
      logar(`⚠️ ${vitima.nome} está enfraquecido(a) pela falta de recursos!`, "destaque");
    }
  }

  estado.personagens.forEach(p => {
    if (p.energia <= 0 && p.status === "vivo") {
      p.status = "morto";
      logar(`💀 ${p.nome} não resistiu...`, "morte");
    }
  });

  estado.dia++;
  estado.clima = aleatorio(["ensolarado", "chuvoso", "nublado", "tempestuoso", "frio"]);

  renderCabecalho();
  renderStatus();

  // Verifica fim
  const tipoFim = verificarFim();
  if (tipoFim) {
    finalizar(tipoFim);
    return;
  }

  // Votação a cada 3 dias a partir do dia 5
  if (estado.dia >= 5 && estado.dia % 3 === 0) {
    abrirVotacao();
  }
}

function verificarFim() {
  if (estado.traidor.status === "morto") return "vitoria_traidor";
  if (estado.jogador.status === "morto") return "morte_jogador";
  if (!vivos().length) return "todos_mortos";
  if (estado.dia > MAX_DIAS) {
    return estado.traidor.status === "vivo" ? "resgate_com_traidor" : "resgate";
  }
  return null;
}

// ---------- Votação ----------
function abrirVotacao() {
  const painel = document.getElementById("painel-votacao");
  const candidatos = vivos().filter(p => !p.isPlayer);
  if (!candidatos.length) return;

  painel.classList.remove("oculto");
  painel.innerHTML = "<h3>🗳️ HORA DA VOTAÇÃO — Quem é o traidor?</h3>";

  candidatos.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "suspeito-btn";
    btn.textContent = `${p.nome} — Suspeita: ${p.suspeita} | Afeto: ${p.afeto}`;
    btn.onclick = () => resolverVotacao(p, candidatos);
    painel.appendChild(btn);
  });

  document.getElementById("btn-proximo-dia").disabled = true;
}

function resolverVotacao(alvoEscolhido, candidatos) {
  const painel = document.getElementById("painel-votacao");
  painel.classList.add("oculto");
  painel.innerHTML = "";

  const votos = {};
  candidatos.forEach(p => votos[p.nome] = 0);

  vivos().forEach(p => {
    if (p.isPlayer) {
      votos[alvoEscolhido.nome]++;
    } else if (p.afeto > 60 && p !== alvoEscolhido) {
      votos[alvoEscolhido.nome]++;
    } else {
      const maisSuspeito = candidatos.reduce((a, b) => a.suspeita > b.suspeita ? a : b);
      votos[maisSuspeito.nome]++;
    }
  });

  const maisVotado = Object.keys(votos).reduce((a, b) => votos[a] > votos[b] ? a : b);
  const eliminado = candidatos.find(p => p.nome === maisVotado);

  logar(`📊 Votos: ${JSON.stringify(votos)}`, "destaque");
  logar(`⚖️ O grupo decidiu eliminar: ${eliminado.nome}`, "destaque");

  if (eliminado.traidor) {
    logar(`🎉 VOCÊS ACERTARAM! ${eliminado.nome} era o traidor!`, "destaque");
    finalizar("vitoria_traidor");
    return;
  }

  eliminado.status = "morto";
  logar(`💔 ${eliminado.nome} era inocente. O traidor ainda está entre vocês...`, "morte");

  renderStatus();
  document.getElementById("btn-proximo-dia").disabled = false;
}

// ---------- Fim ----------
function finalizar(tipo) {
  estado.fim = true;
  document.getElementById("tela-jogo").classList.remove("ativa");
  document.getElementById("tela-fim").classList.add("ativa");

  const finais = {
    vitoria_traidor: {
      titulo: "🎉 O TRAIDOR FOI ELIMINADO!",
      texto: "Vocês descobriram a verdade e salvaram o grupo."
    },
    morte_jogador: {
      titulo: "💀 VOCÊ MORREU.",
      texto: `O traidor era ${estado.traidor.nome}.`
    },
    todos_mortos: {
      titulo: "☠️ TODOS MORRERAM.",
      texto: "A ilha reivindicou todos vocês..."
    },
    resgate_com_traidor: {
      titulo: "🚁 RESGATE CHEGOU... MAS O TRAIDOR ESCAPOU.",
      texto: `O traidor era ${estado.traidor.nome} e se infiltrou entre os sobreviventes.`
    },
    resgate: {
      titulo: "🚁 RESGATE CHEGOU!",
      texto: "Vocês sobreviveram."
    }
  };

  const f = finais[tipo] || { titulo: "Fim", texto: "" };
  document.getElementById("titulo-fim").textContent = f.titulo;
  document.getElementById("texto-fim").textContent = f.texto;
}

// ---------- Inicialização ----------
function iniciar() {
  const nome = document.getElementById("nome-jogador").value.trim() || "Você";
  const linhas = document.getElementById("nomes-amigos").value
    .split("\n").map(l => l.trim()).filter(Boolean);

  const unicos = [];
  linhas.forEach(n => {
    if (!unicos.some(u => u.toLowerCase() === n.toLowerCase())) unicos.push(n);
  });

  const aviso = document.getElementById("aviso-inicio");
  if (unicos.length < 1) {
    aviso.textContent = "⚠️ Digite pelo menos 1 nome de amigo.";
    return;
  }

  const amigos = unicos.slice(0, 11);
  if (unicos.length > 11) {
    aviso.textContent = "⚠️ Apenas os primeiros 11 nomes serão usados.";
  } else {
    aviso.textContent = "";
  }

  novoJogo(nome, amigos);
  document.getElementById("tela-inicio").classList.remove("ativa");
  document.getElementById("tela-jogo").classList.add("ativa");

  limparLog();
  logar(`🏝️ Bem-vindo(a), ${nome}. Alguém entre vocês está planejando algo terrível...`, "destaque");
  renderCabecalho();
  renderStatus();

  document.getElementById("btn-proximo-dia").onclick = passarDia;
  document.getElementById("btn-proximo-dia").disabled = false;
}

function reiniciar() {
  document.getElementById("tela-fim").classList.remove("ativa");
  document.getElementById("tela-inicio").classList.add("ativa");
  document.getElementById("nome-jogador").value = "";
  document.getElementById("nomes-amigos").value = "";
  document.getElementById("aviso-inicio").textContent = "";
}

document.getElementById("btn-comecar").onclick = iniciar;
document.getElementById("btn-reiniciar").onclick = reiniciar;
