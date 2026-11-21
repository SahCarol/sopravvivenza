// ============================================================
//  ilha-da-traicao — jogo.js
//  Sobrevivência, Romance & Traição (versão web)
//  v2.1.0 — 11 campos de amigos + localStorage + história expandida
// ============================================================

const VERSAO = "2.1.0";
const MAX_DIAS = 18;
const STORAGE_KEY = "ilha-da-traicao-config";

const TRACOS = [
  "engraçado(a)", "misterioso(a)", "protetor(a)", "impulsivo(a)",
  "calmo(a)", "ciumento(a)", "observador(a)", "manipulador(a)",
  "leal", "sarcástico(a)", "sonhador(a)", "desconfiado(a)",
  "brincalhão(ona)", "silencioso(a)", "intenso(a)"
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
const sortearVarios = (arr, n) => {
  const copia = [...arr]; const res = [];
  while (res.length < n && copia.length) {
    res.push(copia.splice(Math.floor(Math.random() * copia.length), 1)[0]);
  }
  return res;
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
    this.memorias = 0;
  }
}

// ---------- Estado ----------
let estado = {};

function novoJogo(nomeJogador, nomesAmigos) {
  const jogador = new Personagem(nomeJogador, true);
  const personagens = [jogador, ...nomesAmigos.map(n => new Personagem(n))];

  const candidatos = personagens.filter(p => !p.isPlayer);
  const traidor = aleatorio(candidatos);
  traidor.traidor = true;
  traidor.tracos = "manipulador(a) e frio(a)";

  estado = {
    personagens, jogador, traidor,
    dia: 1,
    clima: "ensolarado",
    fase: "Chegada",
    recursos: { comida: 18, agua: 18, abrigo: 6 },
    investigacao: 0,
    pistasFalsas: 0,
    fim: false,
    eventosUsados: new Set()
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
function marcarMemoria(p) { p.memorias++; }

function escolherEvento(lista) {
  const disponiveis = lista.filter(e => !estado.eventosUsados.has(e.id));
  const escolhido = aleatorio(disponiveis.length ? disponiveis : lista);
  estado.eventosUsados.add(escolhido.id);
  if (estado.eventosUsados.size > 60) estado.eventosUsados.clear();
  return escolhido;
}

// ============================================================
//  BIBLIOTECA DE EVENTOS
// ============================================================

const EVENTOS_VIDA = [
  { id: "v1",  txt: p => `🌿 ${p.nome} encontrou um pé de frutas silvestres. O grupo comeu melhor hoje. (+4 comida)`, fn: () => ajustarRecurso("comida", 4) },
  { id: "v2",  txt: p => `💧 ${p.nome} descobriu um riacho escondido entre as pedras. (+4 água)`, fn: () => ajustarRecurso("agua", 4) },
  { id: "v3",  txt: p => `⛺ ${p.nome} passou o dia reforçando o abrigo com galhos e folhas. (+2 abrigo)`, fn: () => ajustarRecurso("abrigo", 2) },
  { id: "v4",  txt: p => `🩸 ${p.nome} escorregou em uma rocha e torceu o tornozelo. (-20 energia)`, fn: p => { p.energia = Math.max(0, p.energia - 20); p.status = "ferido"; } },
  { id: "v5",  txt: () => `🌪️ Uma tempestade varreu o acampamento. Parte do abrigo foi perdida. (-2 abrigo)`, fn: () => ajustarRecurso("abrigo", -2) },
  { id: "v6",  txt: p => `🐟 ${p.nome} conseguiu pescar com uma lança improvisada. (+3 comida)`, fn: () => ajustarRecurso("comida", 3) },
  { id: "v7",  txt: p => `🍯 ${p.nome} achou um favo de mel numa árvore oca. (+2 comida, +5 energia geral)`, fn: () => { ajustarRecurso("comida", 2); vivos().forEach(v => v.energia = Math.min(100, v.energia + 5)); } },
  { id: "v8",  txt: p => `🐍 ${p.nome} quase pisou numa cobra. Sobreviveu, mas abalado(a). (-10 energia)`, fn: p => p.energia = Math.max(0, p.energia - 10) },
  { id: "v9",  txt: p => `🔥 ${p.nome} acendeu uma fogueira com pedras. Noite aquecida. (+1 abrigo, +5 energia geral)`, fn: () => { ajustarRecurso("abrigo", 1); vivos().forEach(v => v.energia = Math.min(100, v.energia + 5)); } },
  { id: "v10", txt: p => `🥥 ${p.nome} derrubou cocos de uma palmeira. (+2 comida, +2 água)`, fn: () => { ajustarRecurso("comida", 2); ajustarRecurso("agua", 2); } },
  { id: "v11", txt: p => `🏕️ ${p.nome} organizou o acampamento e todos dormiram melhor. (+8 energia geral)`, fn: () => vivos().forEach(v => v.energia = Math.min(100, v.energia + 8)) },
  { id: "v12", txt: p => `🐗 Um javali atacou ${p.nome}. Ferimentos sérios. (-30 energia)`, fn: p => { p.energia = Math.max(0, p.energia - 30); p.status = "ferido"; } },
  { id: "v13", txt: p => `🌊 ${p.nome} encontrou conchas com água da chuva. (+2 água)`, fn: () => ajustarRecurso("agua", 2) },
  { id: "v14", txt: p => `🪵 ${p.nome} trouxe muita lenha. Noite mais quente. (+1 abrigo)`, fn: () => ajustarRecurso("abrigo", 1) },
  { id: "v15", txt: () => `🌧️ Choveu a noite toda. Água transbordou, mas todos exaustos. (+6 água, -8 energia geral)`, fn: () => { ajustarRecurso("agua", 6); vivos().forEach(v => v.energia = Math.max(0, v.energia - 8)); } },
];

const EVENTOS_ROMANCE = [
  { id: "r1",  txt: (p, j) => `💕 ${p.nome} e ${j.nome} conversaram sob as estrelas até tarde. Algo mudou.`, fn: (p, j) => ajustarAfeto(p, j, 18) },
  { id: "r2",  txt: (p, j) => `😳 ${p.nome} salvou ${j.nome} de uma queda. O olhar durou mais que o normal.`, fn: (p, j) => ajustarAfeto(p, j, 22) },
  { id: "r3",  txt: (p, j) => `💔 ${p.nome} evitou ${j.nome} o dia todo. Um mal-entendido pairou no ar.`, fn: (p, j) => ajustarAfeto(p, j, -12) },
  { id: "r4",  txt: (p, j) => `🤝 ${p.nome} confiou um segredo a ${j.nome}. Confiança rara.`, fn: (p, j) => ajustarAfeto(p, j, 12) },
  { id: "r5",  txt: (p, j) => `🌅 ${p.nome} e ${j.nome} viram o nascer do sol juntos em silêncio.`, fn: (p, j) => ajustarAfeto(p, j, 15) },
  { id: "r6",  txt: (p, j) => `🎶 ${p.nome} cantou baixinho para ${j.nome} dormir. O grupo ouviu.`, fn: (p, j) => ajustarAfeto(p, j, 10) },
  { id: "r7",  txt: (p, j) => `💌 ${p.nome} deixou uma flor na "cama" de ${j.nome}. Quem será que viu?`, fn: (p, j) => ajustarAfeto(p, j, 14) },
  { id: "r8",  txt: (p, j) => `🌧️ Presos pela chuva sob o mesmo abrigo, ${p.nome} e ${j.nome} riram até tarde.`, fn: (p, j) => ajustarAfeto(p, j, 16) },
  { id: "r9",  txt: (p, j) => `🫂 ${p.nome} abraçou ${j.nome} quando ele(a) desabou de cansaço.`, fn: (p, j) => ajustarAfeto(p, j, 20) },
  { id: "r10", txt: (p, j) => `😤 ${p.nome} e ${j.nome} discutiram por ciúmes. Tensão visível.`, fn: (p, j) => ajustarAfeto(p, j, -15) },
  { id: "r11", txt: (p, j) => `🌺 ${p.nome} fez uma pulseira de cipó para ${j.nome}. Gestos simples valem ouro.`, fn: (p, j) => ajustarAfeto(p, j, 12) },
  { id: "r12", txt: (p, j) => `🔥 Perto do fogo, ${p.nome} e ${j.nome} falaram sobre o futuro — se sobrevivessem.`, fn: (p, j) => ajustarAfeto(p, j, 15) },
];

const EVENTOS_CONFLITO = [
  { id: "c1", txt: (a, b) => `⚡ ${a.nome} acusou ${b.nome} de roubar comida. Gritos no acampamento.`, fn: (a, b) => { ajustarSuspeita(a, 8); ajustarSuspeita(b, 8); ajustarAfeto(a, b, -8); } },
  { id: "c2", txt: (a, b) => `😤 ${a.nome} e ${b.nome} brigaram sobre quem deveria liderar o grupo.`, fn: (a, b) => { ajustarSuspeita(a, 6); ajustarSuspeita(b, 6); ajustarAfeto(a, b, -6); } },
  { id: "c3", txt: (a, b) => `🔪 ${a.nome} foi visto(a) sussurrando com ${b.nome} tarde da noite.`, fn: (a, b) => ajustarSuspeita(a, 10) },
  { id: "c4", txt: (a, b) => `👀 ${a.nome} desconfia que ${b.nome} está escondendo algo nas roupas.`, fn: (a, b) => ajustarSuspeita(b, 12) },
  { id: "c5", txt: (a, b) => `🥊 ${a.nome} empurrou ${b.nome} durante uma discussão. Quase virou briga.`, fn: (a, b) => { ajustarSuspeita(a, 10); ajustarAfeto(a, b, -12); } },
  { id: "c6", txt: (a, b) => `😡 ${a.nome} humilhou ${b.nome} na frente de todos. O grupo ficou dividido.`, fn: (a, b) => { ajustarSuspeita(a, 12); ajustarAfeto(a, b, -15); } },
  { id: "c7", txt: (a, b) => `🗣️ ${a.nome} contou um segredo de ${b.nome} para o grupo. Traição de confiança.`, fn: (a, b) => { ajustarSuspeita(a, 15); ajustarAfeto(a, b, -18); } },
  { id: "c8", txt: (a, b) => `🧊 ${a.nome} fingiu não ouvir ${b.nome} pedindo ajuda com a comida.`, fn: (a, b) => ajustarAfeto(a, b, -8) },
  { id: "c9", txt: (a, b) => `🌀 ${a.nome} e ${b.nome} se entreolharam de forma estranha após um barulho na mata.`, fn: (a, b) => { ajustarSuspeita(a, 7); ajustarSuspeita(b, 7); } },
];

const EVENTOS_INVESTIGACAO = [
  { id: "i1", txt: alvo => `🔍 Você encontrou uma faca escondida perto do "quarto" de ${alvo.nome}.`, fn: alvo => { estado.investigacao++; ajustarSuspeita(alvo, 20); } },
  { id: "i2", txt: alvo => `🔍 Pegadas estranhas levam até ${alvo.nome}, que estava fora do acampamento à noite.`, fn: alvo => { estado.investigacao++; ajustarSuspeita(alvo, 18); } },
  { id: "i3", txt: alvo => `🔍 Você viu ${alvo.nome} enterrando algo atrás de uma árvore. Quando voltou, não havia nada.`, fn: alvo => { estado.investigacao++; ajustarSuspeita(alvo, 22); } },
  { id: "i4", txt: alvo => `🔍 Uma corda cortada foi encontrada perto de onde ${alvo.nome} dorme.`, fn: alvo => { estado.investigacao++; ajustarSuspeita(alvo, 16); } },
  { id: "i5", txt: alvo => `🔍 Você achou um bilhete com a letra de ${alvo.nome}... mas o conteúdo não fazia sentido.`, fn: alvo => { estado.pistasFalsas++; ajustarSuspeita(alvo, 10); } },
  { id: "i6", txt: alvo => `🔍 ${alvo.nome} estava com as mãos sujas de terra quando todos acordaram.`, fn: alvo => { estado.investigacao++; ajustarSuspeita(alvo, 14); } },
  { id: "i7", txt: alvo => `🔍 Você ouviu ${alvo.nome} falando sozinho(a) sobre "acabar logo com isso".`, fn: alvo => { estado.investigacao++; ajustarSuspeita(alvo, 18); } },
  { id: "i8", txt: alvo => `🔍 Pista falsa: alguém plantou um pertence de ${alvo.nome} na cena de um incidente.`, fn: alvo => { estado.pistasFalsas++; ajustarSuspeita(alvo, 12); } },
];

const EVENTOS_DESCOBERTA = [
  { id: "d1", txt: () => `🗿 O grupo encontrou uma estátua de pedra coberta de musgo. Ninguém sabe quem a fez.` },
  { id: "d2", txt: () => `📜 Uma garrafa com um bilhete chegou à praia: "Não confiem em todos."` },
  { id: "d3", txt: () => `🕳️ Uma caverna foi encontrada na encosta. Vazia, mas com marcas de fogueiras antigas.` },
  { id: "d4", txt: () => `🦴 Ossos de um animal grande foram achados na mata. O grupo evitou a área.` },
  { id: "d5", txt: () => `📻 Um rádio quebrado foi achado nos destroços do barco. Sem bateria, mas dá esperança.` },
  { id: "d6", txt: () => `🌫️ Uma névoa estranha cobriu a ilha pela manhã. Todos ficaram inquietos.` },
  { id: "d7", txt: () => `🪞 Um espelho antigo apareceu numa cabana abandonada. Ninguém entendeu como.` },
  { id: "d8", txt: () => `🐦 Pássaros migraram para longe da ilha. Sinal de que algo está por vir.` },
];

const EVENTOS_NOITE = [
  { id: "n1", txt: () => `🌙 Barulhos estranhos vieram da mata durante a noite. Ninguém dormiu bem. (-6 energia geral)`, fn: () => vivos().forEach(v => v.energia = Math.max(0, v.energia - 6)) },
  { id: "n2", txt: p => `🌌 ${p.nome} ficou de vigia e jurou ter visto uma sombra se movendo.`, fn: p => ajustarSuspeita(p, 5) },
  { id: "n3", txt: p => `🕯️ ${p.nome} não conseguiu dormir. Ficou olhando o mar por horas.`, fn: p => p.energia = Math.max(0, p.energia - 5) },
  { id: "n4", txt: () => `🌠 Uma chuva de estrelas cruzou o céu. Por um instante, todos esqueceram o perigo.` },
  { id: "n5", txt: () => `👣 Pegadas foram encontradas perto do acampamento ao amanhecer. De quem são?`, fn: () => { const v = aleatorio(vivos()); if (v) ajustarSuspeita(v, 6); } },
  { id: "n6", txt: () => `🥶 A noite foi gelada. O grupo se apertou para se aquecer.`, fn: () => { const v = vivos(); v.forEach(a => v.forEach(b => { if (a !== b) ajustarAfeto(a, b, 2); })); } },
];

// ============================================================
//  MOTOR DE EVENTOS
// ============================================================

function rodarEventoVida() {
  const ev = escolherEvento(EVENTOS_VIDA);
  const p = aleatorio(vivos());
  const texto = ev.txt(p);
  if (ev.fn) { try { ev.fn(p); } catch { ev.fn(); } }
  marcarMemoria(p);
  return { txt: texto, classe: "" };
}

function rodarEventoRomance() {
  const cand = vivos().filter(p => !p.isPlayer);
  if (!cand.length) return null;
  const p = aleatorio(cand);
  const ev = escolherEvento(EVENTOS_ROMANCE);
  let texto = ev.txt(p, estado.jogador);
  ev.fn(p, estado.jogador);

  let extra = "";
  if (p.afeto >= 50 && !p.parRomantico) {
    p.parRomantico = estado.jogador.nome;
    extra = `\n💘 ${p.nome} e ${estado.jogador.nome} agora estão oficialmente juntos!`;
  }
  marcarMemoria(p);
  return { txt: texto + extra, classe: "romance" };
}

function rodarEventoConflito() {
  const cand = vivos();
  if (cand.length < 2) return null;
  const [a, b] = sortearVarios(cand, 2);
  const ev = escolherEvento(EVENTOS_CONFLITO);
  const texto = ev.txt(a, b);
  ev.fn(a, b);
  return { txt: texto, classe: "" };
}

function rodarEventoInvestigacao() {
  const suspeitos = vivos().filter(p => !p.isPlayer);
  if (!suspeitos.length) return null;
  const ev = escolherEvento(EVENTOS_INVESTIGACAO);
  let alvo;
  if (Math.random() < 0.6 && estado.traidor.status !== "morto") {
    alvo = estado.traidor;
  } else {
    alvo = aleatorio(suspeitos);
  }
  const texto = ev.txt(alvo);
  ev.fn(alvo);
  return { txt: texto + `\n   (Pistas: ${estado.investigacao} | Falsas: ${estado.pistasFalsas})`, classe: "investigacao" };
}

function rodarEventoDescoberta() {
  const ev = escolherEvento(EVENTOS_DESCOBERTA);
  return { txt: ev.txt(), classe: "" };
}

function rodarEventoNoite() {
  const ev = escolherEvento(EVENTOS_NOITE);
  const p = aleatorio(vivos());
  let texto;
  try { texto = ev.txt(p); } catch { texto = ev.txt(); }
  if (ev.fn) { try { ev.fn(p); } catch { ev.fn(); } }
  return { txt: texto, classe: "noite" };
}

function rodarEventoTraicao() {
  if (estado.traidor.status !== "vivo") return null;
  const vitimas = vivos().filter(p => p !== estado.traidor);
  if (!vitimas.length) return null;

  const pesos = vitimas.map(v => 1 + Math.floor(v.afeto / 20) + (v.isPlayer ? 3 : 0));
  const vitima = aleatorioPonderado(vitimas, pesos);

  let chance = 0.55 - estado.traidor.suspeita / 200 + (100 - vitima.energia) / 300;
  chance = Math.max(0.12, Math.min(0.85, chance));

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
  return { txt: `⚠️ ${vitima.nome} sofreu uma tentativa de assassinato durante a noite!\nSobreviveu, mas está ferido(a) e desconfia de todos.`, classe: "destaque" };
}

// ============================================================
//  FASES
// ============================================================
function faseAtual() {
  if (estado.dia <= 3) return "Chegada";
  if (estado.dia <= 7) return "Organização";
  if (estado.dia <= 12) return "Tensão";
  if (estado.dia <= 15) return "Paranoia";
  return "Desespero";
}

function pesosPorFase() {
  switch (faseAtual()) {
    case "Chegada":     return [50, 25, 10, 5,  10, 0];
    case "Organização": return [40, 25, 15, 10, 10, 0];
    case "Tensão":      return [30, 20, 20, 15, 5,  10];
    case "Paranoia":    return [22, 18, 20, 22, 3,  15];
    case "Desespero":   return [20, 15, 20, 25, 0,  20];
    default:            return [40, 25, 15, 10, 10, 0];
  }
}

// ============================================================
//  RENDERIZAÇÃO
// ============================================================
function renderCabecalho() {
  document.getElementById("info-dia").textContent = `📅 Dia ${estado.dia}`;
  document.getElementById("info-clima").textContent = `☀️ ${estado.clima}`;
  document.getElementById("info-fase").textContent = `🌅 ${faseAtual()}`;
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
    div.className = "cartao-personagem" + (p.isPlayer ? " jogador" : "") + (p.status === "ferido" ? " ferido" : "");
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

function limparLog() { document.getElementById("log").innerHTML = ""; }

// ============================================================
//  TURNO
// ============================================================
function passarDia() {
  if (estado.fim) return;

  const faseAnterior = estado.fase;
  const faseAgora = faseAtual();
  if (faseAgora !== faseAnterior) {
    estado.fase = faseAgora;
    logar(`────────────────────────\n🌅 FASE: ${faseAgora.toUpperCase()}\n────────────────────────`, "fase");
  }

  logar(`📅 DIA ${estado.dia} • ${estado.clima}`, "destaque");

  const climas = [
    { nome: "ensolarado",  efeito: () => {}, emoji: "☀️" },
    { nome: "chuvoso",     efeito: () => ajustarRecurso("agua", 2), emoji: "🌧️" },
    { nome: "nublado",     efeito: () => {}, emoji: "☁️" },
    { nome: "tempestuoso", efeito: () => { ajustarRecurso("abrigo", -1); vivos().forEach(v => v.energia = Math.max(0, v.energia - 5)); }, emoji: "⛈️" },
    { nome: "frio",        efeito: () => vivos().forEach(v => v.energia = Math.max(0, v.energia - 4)), emoji: "🌬️" },
    { nome: "abafado",     efeito: () => {}, emoji: "🔥" },
  ];
  const climaHoje = aleatorio(climas);
  estado.clima = climaHoje.nome;
  climaHoje.efeito();
  logar(`${climaHoje.emoji} Clima: ${climaHoje.nome}.`, "clima");

  const num = 2 + Math.floor(Math.random() * 3);
  const tipos = ["vida", "romance", "conflito", "investigacao", "descoberta", "noite"];
  const pesos = pesosPorFase();

  for (let i = 0; i < num; i++) {
    const tipo = aleatorioPonderado(tipos, pesos);
    let ev = null;
    if (tipo === "vida")         ev = rodarEventoVida();
    if (tipo === "romance")      ev = rodarEventoRomance();
    if (tipo === "conflito")     ev = rodarEventoConflito();
    if (tipo === "investigacao") ev = rodarEventoInvestigacao();
    if (tipo === "descoberta")   ev = rodarEventoDescoberta();
    if (tipo === "noite")        ev = rodarEventoNoite();
    if (ev) logar(ev.txt, ev.classe);
  }

  if (estado.dia >= 2 && estado.traidor.status === "vivo") {
    const chance = 0.25 + estado.dia * 0.04;
    if (Math.random() < chance) {
      const ev = rodarEventoTraicao();
      if (ev) logar(ev.txt, ev.classe);
    }
  }

  const v = vivos();
  estado.recursos.comida = Math.max(0, estado.recursos.comida - v.length * 0.4);
  estado.recursos.agua = Math.max(0, estado.recursos.agua - v.length * 0.4);

  if (estado.recursos.comida <= 0 || estado.recursos.agua <= 0) {
    const vitima = aleatorio(v);
    if (vitima) {
      vitima.energia = Math.max(0, vitima.energia - 25);
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
  renderCabecalho();
  renderStatus();

  const tipoFim = verificarFim();
  if (tipoFim) { finalizar(tipoFim); return; }

  if (estado.dia >= 5 && estado.dia % 3 === 0 && vivos().length > 2) {
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

// ============================================================
//  VOTAÇÃO
// ============================================================
function abrirVotacao() {
  const painel = document.getElementById("painel-votacao");
  const candidatos = vivos().filter(p => !p.isPlayer);
  if (!candidatos.length) return;

  painel.classList.remove("oculto");
  painel.innerHTML = "<h3>🗳️ HORA DA VOTAÇÃO — Quem é o traidor?</h3>";

  candidatos.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "suspeito-btn";
    btn.textContent = `${p.nome} — Suspeita: ${p.suspeita} | Afeto: ${p.afeto} | ${p.tracos}`;
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

// ============================================================
//  REVELAÇÃO DO TRAIDOR
// ============================================================
function revelarTraidor() {
  const painel = document.getElementById("painel-traidor");
  const info = document.getElementById("traidor-info");
  const t = estado.traidor;

  info.innerHTML = `
    <strong>${t.nome}</strong>
    era o traidor infiltrado.
    <br>
    <span class="tag-traidor">🎭 ${t.tracos}</span>
    <span class="tag-traidor">💀 Status: ${t.status}</span>
    <span class="tag-traidor">🔍 Suspeita final: ${t.suspeita}</span>
    <span class="tag-traidor">📅 Dia final: ${estado.dia - 1}</span>
  `;

  painel.classList.remove("oculto");
  painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ============================================================
//  FIM
// ============================================================
function finalizar(tipo) {
  estado.fim = true;
  revelarTraidor();

  document.getElementById("btn-proximo-dia").disabled = true;
  document.getElementById("btn-espiar").classList.add("oculto");

  const acoes = document.getElementById("acoes");
  if (!document.getElementById("btn-reiniciar-inline")) {
    const btn = document.createElement("button");
    btn.id = "btn-reiniciar-inline";
    btn.textContent = "🔄 Jogar Novamente";
    btn.onclick = reiniciar;
    acoes.appendChild(btn);
  }

  const finais = {
    vitoria_traidor: {
      titulo: "🎉 O TRAIDOR FOI ELIMINADO!",
      texto: "Vocês descobriram a verdade e salvaram o grupo."
    },
    morte_jogador: {
      titulo: "💀 VOCÊ MORREU.",
      texto: `O traidor era ${estado.traidor.nome}. A ilha guardou mais um segredo.`
    },
    todos_mortos: {
      titulo: "☠️ TODOS MORRERAM.",
      texto: "A ilha reivindicou todos vocês. Nenhuma história restou para contar."
    },
    resgate_com_traidor: {
      titulo: "🚁 RESGATE CHEGOU... MAS O TRAIDOR ESCAPOU.",
      texto: `O traidor era ${estado.traidor.nome} e se infiltrou entre os sobreviventes.`
    },
    resgate: {
      titulo: "🚁 RESGATE CHEGOU!",
      texto: "Vocês sobreviveram... e descobriram que a ilha não era o maior perigo."
    }
  };

  const f = finais[tipo] || { titulo: "Fim", texto: "" };
  logar(`\n🏁 FIM DE JOGO — ${f.titulo}\n${f.texto}`, "destaque");
}

// ============================================================
//  TELA INICIAL: 11 CAMPOS DE AMIGOS
// ============================================================
function criarCamposAmigos() {
  const grid = document.getElementById("grid-amigos");
  if (!grid) return;
  grid.innerHTML = "";

  for (let i = 1; i <= 11; i++) {
    const wrap = document.createElement("div");
    wrap.className = "campo-amigo";

    const num = document.createElement("span");
    num.className = "numero";
    num.textContent = i;

    const inp = document.createElement("input");
    inp.type = "text";
    inp.id = `amigo-${i}`;
    inp.placeholder = `Amigo ${i} (opcional)`;
    inp.maxLength = 20;
    inp.autocomplete = "off";

    // Enter avança para o próximo campo
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (i < 11) {
          document.getElementById(`amigo-${i + 1}`)?.focus();
        } else {
          document.getElementById("btn-comecar").focus();
        }
      }
    });

    wrap.appendChild(num);
    wrap.appendChild(inp);
    grid.appendChild(wrap);
  }
}

// ---------- localStorage ----------
function salvarNomes(nomeJogador, amigos) {
  try {
    const dados = { nomeJogador, amigos };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
  } catch (e) { /* ignora se localStorage indisponível */ }
}

function carregarNomes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const dados = JSON.parse(raw);
    document.getElementById("nome-jogador").value = dados.nomeJogador || "";
    (dados.amigos || []).forEach((n, i) => {
      const inp = document.getElementById(`amigo-${i + 1}`);
      if (inp) inp.value = n;
    });
  } catch (e) { /* ignora */ }
}

// ============================================================
//  INICIALIZAÇÃO
// ============================================================
function iniciar() {
  const nome = document.getElementById("nome-jogador").value.trim() || "Você";

  const nomes = [];
  for (let i = 1; i <= 11; i++) {
    const inp = document.getElementById(`amigo-${i}`);
    if (!inp) continue;
    const v = inp.value.trim();
    if (v) nomes.push(v);
  }

  const aviso = document.getElementById("aviso-inicio");

  // Remove duplicados e nome igual ao do jogador
  const unicos = [];
  nomes.forEach(n => {
    const igual = unicos.some(u => u.toLowerCase() === n.toLowerCase());
    const igualJogador = n.toLowerCase() === nome.toLowerCase();
    if (!igual && !igualJogador) unicos.push(n);
  });

  if (unicos.length < 1) {
    aviso.textContent = "⚠️ Digite pelo menos 1 nome de amigo.";
    return;
  }

  if (unicos.length < nomes.length) {
    aviso.textContent = "⚠️ Alguns nomes repetidos foram ignorados.";
  } else {
    aviso.textContent = "";
  }

  // Salva no localStorage
  salvarNomes(nome, unicos);

  novoJogo(nome, unicos);

  document.getElementById("tela-inicio").classList.remove("ativa");
  document.getElementById("tela-jogo").classList.add("ativa");

  limparLog();
  logar(`🏝️ ${nome}, você e seus amigos estão presos na ilha após um naufrágio.`, "destaque");
  logar(`🌑 Alguém entre vocês está planejando algo terrível...`, "destaque");
  logar(`👥 Grupo: ${estado.personagens.map(p => p.nome).join(", ")}`, "clima");

  renderCabecalho();
  renderStatus();

  document.getElementById("btn-proximo-dia").onclick = passarDia;
  document.getElementById("btn-proximo-dia").disabled = false;

  document.getElementById("btn-espiar").classList.remove("oculto");
  document.getElementById("btn-espiar").onclick = () => {
    if (estado.traidor) revelarTraidor();
  };
}

function reiniciar() {
  document.getElementById("tela-fim").classList.remove("ativa");
  document.getElementById("tela-inicio").classList.add("ativa");
  document.getElementById("nome-jogador").value = "";

  for (let i = 1; i <= 11; i++) {
    const inp = document.getElementById(`amigo-${i}`);
    if (inp) inp.value = "";
  }

  document.getElementById("aviso-inicio").textContent = "";

  document.getElementById("painel-traidor").classList.add("oculto");
  document.getElementById("traidor-info").innerHTML = "";
  document.getElementById("btn-espiar").classList.add("oculto");

  const btnInline = document.getElementById("btn-reiniciar-inline");
  if (btnInline) btnInline.remove();

  document.getElementById("painel-votacao").classList.add("oculto");
  document.getElementById("painel-votacao").innerHTML = "";

  // Recarrega nomes salvos
  carregarNomes();
}

// ============================================================
//  BOOTSTRAP
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  criarCamposAmigos();
  carregarNomes();

  document.getElementById("btn-comecar").onclick = iniciar;
  document.getElementById("btn-reiniciar").onclick = reiniciar;
});
