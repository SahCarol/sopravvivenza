// ============================================================
//  ilha-da-traicao — jogo.js
//  v4.0.0 — fim só quando o traidor é descoberto ou todos morrem
// ============================================================

const VERSAO = "4.0.0";
const STORAGE_KEY = "ilha-da-traicao-config";

const TRACOS = [
  "engraçado(a)", "misterioso(a)", "protetor(a)", "impulsivo(a)",
  "calmo(a)", "ciumento(a)", "observador(a)", "manipulador(a)",
  "leal", "sarcástico(a)", "sonhador(a)", "desconfiado(a)",
  "brincalhão(ona)", "silencioso(a)", "intenso(a)", "vingativo(a)",
  "carismático(a)", "reservado(a)"
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
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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
    this.tentativasAssassinato = 0;
  }
}

// ---------- Estado ----------
let estado = {};

function novoJogo(nomeJogador, nomesAmigos, duracao) {
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
    duracao: clamp(duracao, 10, 40),
    recursos: { comida: 20, agua: 20, abrigo: 8 },
    investigacao: 0,
    pistasFalsas: 0,
    fim: false,
    eventosUsados: new Set(),
    traidorEliminadoPorVotacao: false,
    votacoesFeitas: 0,
    intervaloVotacao: 4,
    eventosPorDia: 4,
    diaInicioTraicao: 2,
    espectador: false,
    mortesRecentes: 0
  };

  const D = estado.duracao;
  estado.intervaloVotacao = clamp(Math.round(D / 6), 3, 5);
  estado.eventosPorDia   = clamp(Math.round(3 + D / 20), 3, 5);
  estado.diaInicioTraicao = D <= 15 ? 2 : D <= 25 ? 3 : 4;
}

const vivos = () => estado.personagens.filter(p => p.status === "vivo");
const inocentesVivos = () => vivos().filter(p => !p.traidor);

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
  if (estado.eventosUsados.size > 120) estado.eventosUsados.clear();
  return escolhido;
}

// ============================================================
//  EVENTOS (mesmos 111 da v3)
// ============================================================
const EVENTOS_VIDA = [
  { id: "v1",  txt: p => `🌿 ${p.nome} encontrou um pé de frutas silvestres. (+4 comida)`, fn: () => ajustarRecurso("comida", 4) },
  { id: "v2",  txt: p => `💧 ${p.nome} descobriu um riacho escondido. (+4 água)`, fn: () => ajustarRecurso("agua", 4) },
  { id: "v3",  txt: p => `⛺ ${p.nome} reforçou o abrigo. (+2 abrigo)`, fn: () => ajustarRecurso("abrigo", 2) },
  { id: "v4",  txt: p => `🩸 ${p.nome} torceu o tornozelo. (-20 energia)`, fn: p => { p.energia = Math.max(0, p.energia - 20); p.status = "ferido"; } },
  { id: "v5",  txt: () => `🌪️ Tempestade. (-2 abrigo)`, fn: () => ajustarRecurso("abrigo", -2) },
  { id: "v6",  txt: p => `🐟 ${p.nome} pescou. (+3 comida)`, fn: () => ajustarRecurso("comida", 3) },
  { id: "v7",  txt: p => `🍯 ${p.nome} achou mel. (+2 comida, +5 energia geral)`, fn: () => { ajustarRecurso("comida", 2); vivos().forEach(v => v.energia = Math.min(100, v.energia + 5)); } },
  { id: "v8",  txt: p => `🐍 ${p.nome} quase pisou numa cobra. (-10 energia)`, fn: p => p.energia = Math.max(0, p.energia - 10) },
  { id: "v9",  txt: p => `🔥 ${p.nome} acendeu fogueira. (+1 abrigo, +5 energia)`, fn: () => { ajustarRecurso("abrigo", 1); vivos().forEach(v => v.energia = Math.min(100, v.energia + 5)); } },
  { id: "v10", txt: p => `🥥 ${p.nome} derrubou cocos. (+2 comida, +2 água)`, fn: () => { ajustarRecurso("comida", 2); ajustarRecurso("agua", 2); } },
  { id: "v11", txt: p => `🏕️ ${p.nome} organizou o acampamento. (+8 energia geral)`, fn: () => vivos().forEach(v => v.energia = Math.min(100, v.energia + 8)) },
  { id: "v12", txt: p => `🐗 Javali atacou ${p.nome}. (-30 energia)`, fn: p => { p.energia = Math.max(0, p.energia - 30); p.status = "ferido"; } },
  { id: "v13", txt: p => `🌊 ${p.nome} achou água em conchas. (+2 água)`, fn: () => ajustarRecurso("agua", 2) },
  { id: "v14", txt: p => `🪵 ${p.nome} trouxe lenha. (+1 abrigo)`, fn: () => ajustarRecurso("abrigo", 1) },
  { id: "v15", txt: () => `🌧️ Chuva forte. (+6 água, -8 energia geral)`, fn: () => { ajustarRecurso("agua", 6); vivos().forEach(v => v.energia = Math.max(0, v.energia - 8)); } },
  { id: "v16", txt: p => `🪤 ${p.nome} pegou coelho. (+3 comida)`, fn: () => ajustarRecurso("comida", 3) },
  { id: "v17", txt: p => `🌱 ${p.nome} começou uma horta. (+5 comida)`, fn: () => ajustarRecurso("comida", 5) },
  { id: "v18", txt: p => `🦀 ${p.nome} achou caranguejos. (+4 comida)`, fn: () => ajustarRecurso("comida", 4) },
  { id: "v19", txt: p => `🧗 ${p.nome} escalou árvore. (+2 comida, -5 energia)`, fn: p => { ajustarRecurso("comida", 2); p.energia = Math.max(0, p.energia - 5); } },
  { id: "v20", txt: p => `💦 ${p.nome} caiu no rio. (-10 energia, +3 água)`, fn: p => { p.energia = Math.max(0, p.energia - 10); ajustarRecurso("agua", 3); } },
  { id: "v21", txt: () => `🌊 Maré molhou mantimentos. (-2 comida)`, fn: () => ajustarRecurso("comida", -2) },
  { id: "v22", txt: p => `🌾 ${p.nome} achou plantas comestíveis. (+5 comida)`, fn: () => ajustarRecurso("comida", 5) },
];

const EVENTOS_ROMANCE = [
  { id: "r1",  txt: (p, j) => `💕 ${p.nome} e ${j.nome} conversaram sob as estrelas.`, fn: (p, j) => ajustarAfeto(p, j, 18) },
  { id: "r2",  txt: (p, j) => `😳 ${p.nome} salvou ${j.nome} de uma queda.`, fn: (p, j) => ajustarAfeto(p, j, 22) },
  { id: "r3",  txt: (p, j) => `💔 ${p.nome} evitou ${j.nome} o dia todo.`, fn: (p, j) => ajustarAfeto(p, j, -12) },
  { id: "r4",  txt: (p, j) => `🤝 ${p.nome} confiou um segredo a ${j.nome}.`, fn: (p, j) => ajustarAfeto(p, j, 12) },
  { id: "r5",  txt: (p, j) => `🌅 ${p.nome} e ${j.nome} viram o nascer do sol.`, fn: (p, j) => ajustarAfeto(p, j, 15) },
  { id: "r6",  txt: (p, j) => `🎶 ${p.nome} cantou para ${j.nome} dormir.`, fn: (p, j) => ajustarAfeto(p, j, 10) },
  { id: "r7",  txt: (p, j) => `💌 ${p.nome} deixou uma flor para ${j.nome}.`, fn: (p, j) => ajustarAfeto(p, j, 14) },
  { id: "r8",  txt: (p, j) => `🌧️ Presos pela chuva, ${p.nome} e ${j.nome} riram.`, fn: (p, j) => ajustarAfeto(p, j, 16) },
  { id: "r9",  txt: (p, j) => `🫂 ${p.nome} abraçou ${j.nome}.`, fn: (p, j) => ajustarAfeto(p, j, 20) },
  { id: "r10", txt: (p, j) => `😤 ${p.nome} e ${j.nome} brigaram por ciúmes.`, fn: (p, j) => ajustarAfeto(p, j, -15) },
  { id: "r11", txt: (p, j) => `🌺 ${p.nome} fez pulseira para ${j.nome}.`, fn: (p, j) => ajustarAfeto(p, j, 12) },
  { id: "r12", txt: (p, j) => `🔥 ${p.nome} e ${j.nome} falaram do futuro.`, fn: (p, j) => ajustarAfeto(p, j, 15) },
  { id: "r13", txt: (p, j) => `💋 ${p.nome} beijou ${j.nome} de surpresa.`, fn: (p, j) => ajustarAfeto(p, j, 25) },
  { id: "r14", txt: (p, j) => `🌙 ${p.nome} e ${j.nome} dormiram de mãos dadas.`, fn: (p, j) => ajustarAfeto(p, j, 20) },
  { id: "r15", txt: (p, j) => `🎁 ${p.nome} deu presente a ${j.nome}.`, fn: (p, j) => ajustarAfeto(p, j, 14) },
  { id: "r16", txt: (p, j) => `👀 ${p.nome} flagrou ${j.nome} olhando.`, fn: (p, j) => ajustarAfeto(p, j, 12) },
  { id: "r17", txt: (p, j) => `🌠 ${p.nome} e ${j.nome} fizeram pedido juntos.`, fn: (p, j) => ajustarAfeto(p, j, 15) },
  { id: "r18", txt: (p, j) => `😔 ${p.nome} revelou medo a ${j.nome}.`, fn: (p, j) => ajustarAfeto(p, j, 18) },
  { id: "r19", txt: (p, j) => `🥺 ${p.nome} pediu desculpas a ${j.nome}.`, fn: (p, j) => ajustarAfeto(p, j, 12) },
  { id: "r20", txt: (p, j) => `💍 ${p.nome} prometeu a ${j.nome} sobreviver juntos.`, fn: (p, j) => ajustarAfeto(p, j, 22) },
];

const EVENTOS_CONFLITO = [
  { id: "c1",  txt: (a, b) => `⚡ ${a.nome} acusou ${b.nome} de roubar comida.`, fn: (a, b) => { ajustarSuspeita(a, 8); ajustarSuspeita(b, 8); ajustarAfeto(a, b, -8); } },
  { id: "c2",  txt: (a, b) => `😤 ${a.nome} e ${b.nome} brigaram por liderança.`, fn: (a, b) => { ajustarSuspeita(a, 6); ajustarSuspeita(b, 6); ajustarAfeto(a, b, -6); } },
  { id: "c3",  txt: (a, b) => `🔪 ${a.nome} sussurrou com ${b.nome} à noite.`, fn: (a, b) => ajustarSuspeita(a, 10) },
  { id: "c4",  txt: (a, b) => `👀 ${a.nome} desconfia de ${b.nome}.`, fn: (a, b) => ajustarSuspeita(b, 12) },
  { id: "c5",  txt: (a, b) => `🥊 ${a.nome} empurrou ${b.nome}.`, fn: (a, b) => { ajustarSuspeita(a, 10); ajustarAfeto(a, b, -12); } },
  { id: "c6",  txt: (a, b) => `😡 ${a.nome} humilhou ${b.nome}.`, fn: (a, b) => { ajustarSuspeita(a, 12); ajustarAfeto(a, b, -15); } },
  { id: "c7",  txt: (a, b) => `🗣️ ${a.nome} contou segredo de ${b.nome}.`, fn: (a, b) => { ajustarSuspeita(a, 15); ajustarAfeto(a, b, -18); } },
  { id: "c8",  txt: (a, b) => `🧊 ${a.nome} ignorou ${b.nome}.`, fn: (a, b) => ajustarAfeto(a, b, -8) },
  { id: "c9",  txt: (a, b) => `🌀 ${a.nome} e ${b.nome} se entreolharam estranho.`, fn: (a, b) => { ajustarSuspeita(a, 7); ajustarSuspeita(b, 7); } },
  { id: "c10", txt: (a, b) => `🔥 ${a.nome} e ${b.nome} gritaram um com o outro.`, fn: (a, b) => { ajustarAfeto(a, b, -20); a.energia = Math.max(0, a.energia - 5); } },
  { id: "c11", txt: (a, b) => `🍽️ ${a.nome} comeu porção de ${b.nome}.`, fn: (a, b) => { ajustarSuspeita(a, 14); ajustarAfeto(a, b, -15); } },
  { id: "c12", txt: (a, b) => `🤬 ${a.nome} chamou ${b.nome} de inútil.`, fn: (a, b) => { ajustarAfeto(a, b, -22); ajustarSuspeita(a, 10); } },
  { id: "c13", txt: (a, b) => `🗡️ ${a.nome} ameaçou ${b.nome}.`, fn: (a, b) => { ajustarSuspeita(a, 20); ajustarAfeto(a, b, -25); } },
  { id: "c14", txt: (a, b) => `💢 ${a.nome} quebrou objeto de ${b.nome}.`, fn: (a, b) => { ajustarAfeto(a, b, -18); ajustarSuspeita(a, 12); } },
  { id: "c15", txt: (a, b) => `🤐 ${a.nome} e ${b.nome} pararam de se falar.`, fn: (a, b) => ajustarAfeto(a, b, -25) },
  { id: "c16", txt: (a, b) => `💔 ${a.nome} descobriu mentira de ${b.nome}.`, fn: (a, b) => { ajustarAfeto(a, b, -20); ajustarSuspeita(b, 15); } },
  { id: "c17", txt: (a, b) => `🤜 ${a.nome} deu soco em ${b.nome}.`, fn: (a, b) => { ajustarAfeto(a, b, -30); ajustarSuspeita(a, 18); b.energia = Math.max(0, b.energia - 15); } },
  { id: "c18", txt: (a, b) => `🥀 ${a.nome} humilhou passado de ${b.nome}.`, fn: (a, b) => { ajustarAfeto(a, b, -22); ajustarSuspeita(a, 14); } },
  { id: "c19", txt: (a, b) => `🚫 ${a.nome} negou água a ${b.nome}.`, fn: (a, b) => { ajustarAfeto(a, b, -18); b.energia = Math.max(0, b.energia - 8); } },
  { id: "c20", txt: (a, b) => `😠 ${a.nome} e ${b.nome} discutiram sobre vigia.`, fn: (a, b) => ajustarAfeto(a, b, -10) },
  { id: "c21", txt: (a, b) => `🕵️ ${a.nome} acusou ${b.nome} de ser traidor.`, fn: (a, b) => { ajustarSuspeita(b, 25); ajustarAfeto(a, b, -20); } },
  { id: "c22", txt: (a, b) => `🧨 ${a.nome} sabotou comida de ${b.nome}.`, fn: (a, b) => { ajustarSuspeita(a, 22); ajustarAfeto(a, b, -20); } },
  { id: "c23", txt: (a, b) => `😈 ${a.nome} espalhou boato sobre ${b.nome}.`, fn: (a, b) => { ajustarSuspeita(b, 15); ajustarAfeto(a, b, -15); } },
  { id: "c24", txt: (a, b) => `☠️ ${a.nome} jurou vingança contra ${b.nome}.`, fn: (a, b) => { ajustarSuspeita(a, 25); ajustarAfeto(a, b, -30); } },
];

const EVENTOS_INVESTIGACAO = [
  { id: "i1",  txt: a => `🔍 Faca escondida perto de ${a.nome}.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 20); } },
  { id: "i2",  txt: a => `🔍 Pegadas levam a ${a.nome} fora do acampamento.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 18); } },
  { id: "i3",  txt: a => `🔍 Você viu ${a.nome} enterrando algo.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 22); } },
  { id: "i4",  txt: a => `🔍 Corda cortada perto de ${a.nome}.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 16); } },
  { id: "i5",  txt: a => `🔍 Bilhete suspeito de ${a.nome}.`, fn: a => { estado.pistasFalsas++; ajustarSuspeita(a, 10); } },
  { id: "i6",  txt: a => `🔍 ${a.nome} com mãos sujas de terra.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 14); } },
  { id: "i7",  txt: a => `🔍 ${a.nome} falando "acabar logo com isso".`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 18); } },
  { id: "i8",  txt: a => `🔍 Pista falsa perto de ${a.nome}.`, fn: a => { estado.pistasFalsas++; ajustarSuspeita(a, 12); } },
  { id: "i9",  txt: a => `🔍 ${a.nome} observando o acampamento.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 15); } },
  { id: "i10", txt: a => `🔍 ${a.nome} mexendo nas ferramentas.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 20); } },
  { id: "i11", txt: a => `🔍 ${a.nome} com arranhão suspeito.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 12); } },
  { id: "i12", txt: a => `🔍 Comida escondida de ${a.nome}.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 18); } },
  { id: "i13", txt: a => `🔍 Nota anônima acusando ${a.nome}.`, fn: a => { estado.pistasFalsas++; ajustarSuspeita(a, 14); } },
  { id: "i14", txt: a => `🔍 ${a.nome} não dormiu esta noite.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 15); } },
  { id: "i15", txt: a => `🔍 ${a.nome} trocando olhares à noite.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 10); } },
  { id: "i16", txt: a => `🔍 Sangue na roupa de ${a.nome}.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 25); } },
  { id: "i17", txt: a => `🔍 ${a.nome} apagou pegadas.`, fn: a => { estado.investigacao++; ajustarSuspeita(a, 20); } },
  { id: "i18", txt: a => `🔍 Carta "confissão" perto de ${a.nome}.`, fn: a => { estado.pistasFalsas++; ajustarSuspeita(a, 16); } },
];

const EVENTOS_DESCOBERTA = [
  { id: "d1",  txt: () => `🗿 Estátua de pedra coberta de musgo.` },
  { id: "d2",  txt: () => `📜 Garrafa com bilhete: "Não confiem em todos."` },
  { id: "d3",  txt: () => `🕳️ Caverna com fogueiras antigas.` },
  { id: "d4",  txt: () => `🦴 Ossos de animal grande.` },
  { id: "d5",  txt: () => `📻 Rádio quebrado nos destroços.` },
  { id: "d6",  txt: () => `🌫️ Névoa estranha cobriu a ilha.` },
  { id: "d7",  txt: () => `🪞 Espelho antigo numa cabana.` },
  { id: "d8",  txt: () => `🐦 Pássaros migraram para longe.` },
  { id: "d9",  txt: () => `📓 Diário: "Ele não era quem dizia ser..."` },
  { id: "d10", txt: () => `🪦 Lápide no meio da mata.` },
  { id: "d11", txt: () => `🎒 Mochila de alguém que não está mais vivo.` },
  { id: "d12", txt: () => `🗺️ Mapa com "X" vermelho.` },
  { id: "d13", txt: () => `🧭 Bússola quebrada apontando para a mata.` },
  { id: "d14", txt: () => `🌋 Fumaça de montanha distante.` },
  { id: "d15", txt: () => `💀 Esqueleto humano com pulseira conhecida.` },
];

const EVENTOS_NOITE = [
  { id: "n1",  txt: () => `🌙 Barulhos na mata. (-6 energia geral)`, fn: () => vivos().forEach(v => v.energia = Math.max(0, v.energia - 6)) },
  { id: "n2",  txt: p => `🌌 ${p.nome} viu sombra na vigia.`, fn: p => ajustarSuspeita(p, 5) },
  { id: "n3",  txt: p => `🕯️ ${p.nome} não dormiu.`, fn: p => p.energia = Math.max(0, p.energia - 5) },
  { id: "n4",  txt: () => `🌠 Chuva de estrelas.` },
  { id: "n5",  txt: () => `👣 Pegadas ao redor do acampamento.`, fn: () => { const v = aleatorio(vivos()); if (v) ajustarSuspeita(v, 6); } },
  { id: "n6",  txt: () => `🥶 Noite gelada.`, fn: () => { const v = vivos(); v.forEach(a => v.forEach(b => { if (a !== b) ajustarAfeto(a, b, 2); })); } },
  { id: "n7",  txt: p => `🩸 ${p.nome} acordou com arranhões.`, fn: p => { p.energia = Math.max(0, p.energia - 10); ajustarSuspeita(p, 8); } },
  { id: "n8",  txt: () => `🔦 Alguém andou à noite. Ninguém assume.`, fn: () => { const v = aleatorio(vivos()); if (v) ajustarSuspeita(v, 10); } },
  { id: "n9",  txt: p => `🗣️ ${p.nome} conversando sozinho.`, fn: p => ajustarSuspeita(p, 7) },
  { id: "n10", txt: () => `😱 Grito na madrugada. (-4 energia geral)`, fn: () => vivos().forEach(v => v.energia = Math.max(0, v.energia - 4)) },
  { id: "n11", txt: p => `🔥 ${p.nome} manteve o fogo aceso. (+4 energia geral)`, fn: () => vivos().forEach(v => v.energia = Math.min(100, v.energia + 4)) },
  { id: "n12", txt: () => `🌊 Maré subiu.`, fn: () => vivos().forEach(v => v.energia = Math.max(0, v.energia - 5)) },
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

  // Letalidade: base + progresso do dia em relação à duração (mas nunca 0)
  const progresso = clamp(estado.dia / estado.duracao, 0, 1.2);
  let chanceBase = 0.15 + progresso * 0.55;
  let chance = chanceBase - estado.traidor.suspeita / 200 + (100 - vitima.energia) / 400;
  chance = Math.max(0.08, Math.min(0.80, chance));

  estado.traidor.tentativasAssassinato++;
  if (estado.traidor.tentativasAssassinato % 3 === 0) {
    ajustarSuspeita(estado.traidor, 12);
  }

  if (Math.random() < chance) {
    vitima.status = "morto";
    vitima.energia = 0;
    ajustarSuspeita(estado.traidor, 10);
    estado.mortesRecentes++;
    return { txt: `💀 ${vitima.nome} foi encontrado(a) morto(a) esta manhã.\nNinguém viu nada. O grupo está em pânico.`, classe: "morte" };
  }
  vitima.status = "ferido";
  vitima.energia = Math.max(10, vitima.energia - 30);
  ajustarSuspeita(estado.traidor, 20);
  ajustarAfeto(vitima, estado.jogador, 5);
  return { txt: `⚠️ ${vitima.nome} sofreu uma tentativa de assassinato durante a noite!\nSobreviveu, mas está ferido(a).`, classe: "destaque" };
}

// ============================================================
//  FASES (proporcionais à duração)
// ============================================================
function faseAtual() {
  const p = clamp(estado.dia / estado.duracao, 0, 1);
  if (p <= 0.12) return "Chegada";
  if (p <= 0.28) return "Organização";
  if (p <= 0.44) return "Tensão";
  if (p <= 0.56) return "Desconfiança";
  if (p <= 0.68) return "Paranoia";
  if (p <= 0.84) return "Desespero";
  return "Colapso";
}

function pesosPorFase() {
  switch (faseAtual()) {
    case "Chegada":      return [55, 25, 10, 5,  5,  0];
    case "Organização":  return [45, 25, 15, 8,  7,  0];
    case "Tensão":       return [35, 20, 20, 12, 5,  8];
    case "Desconfiança": return [28, 18, 22, 18, 4,  10];
    case "Paranoia":     return [22, 15, 22, 22, 2,  17];
    case "Desespero":    return [18, 12, 22, 25, 0,  23];
    case "Colapso":      return [15, 10, 25, 25, 0,  25];
    default:             return [40, 25, 15, 10, 5,  5];
  }
}

// ============================================================
//  RENDERIZAÇÃO
// ============================================================
function renderCabecalho() {
  document.getElementById("info-dia").textContent = `📅 Dia ${estado.dia} (est. ${estado.duracao})`;
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
    const emoji = p.status === "morto" ? "🖤" : p.energia > 60 ? "💚" : p.energia > 30 ? "💛" : "❤️";
    const classes = ["cartao-personagem"];
    if (p.isPlayer) classes.push("jogador");
    if (p.status === "ferido") classes.push("ferido");
    if (p.status === "morto") classes.push("morto-visivel");

    const div = document.createElement("div");
    div.className = classes.join(" ");
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

  // Clima
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

  // Eventos
  const num = estado.eventosPorDia;
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

  // Traição
  if (estado.dia >= estado.diaInicioTraicao && estado.traidor.status === "vivo") {
    const progresso = clamp(estado.dia / estado.duracao, 0, 1.2);
    const chance = 0.15 + progresso * 0.35;
    if (Math.random() < chance) {
      const ev = rodarEventoTraicao();
      if (ev) logar(ev.txt, ev.classe);
    }
  }

  // Consumo
  const v = vivos();
  estado.recursos.comida = Math.max(0, estado.recursos.comida - v.length * 0.35);
  estado.recursos.agua = Math.max(0, estado.recursos.agua - v.length * 0.35);

  if (estado.recursos.comida <= 0 || estado.recursos.agua <= 0) {
    const vitima = aleatorio(v);
    if (vitima) {
      vitima.energia = Math.max(0, vitima.energia - 20);
      logar(`⚠️ ${vitima.nome} está enfraquecido(a) pela falta de recursos!`, "destaque");
    }
  }

  // Mortes por exaustão
  estado.personagens.forEach(p => {
    if (p.energia <= 0 && p.status === "vivo") {
      p.status = "morto";
      logar(`💀 ${p.nome} não resistiu...`, "morte");
    }
  });

  estado.dia++;
  renderCabecalho();
  renderStatus();

  // Detectar se o jogador morreu
  if (estado.jogador.status === "morto" && !estado.espectador) {
    estado.espectador = true;
    document.getElementById("aviso-espectador").classList.remove("oculto");
    logar(`👻 ${estado.jogador.nome} morreu. Você agora é espectador — a história continua.`, "destaque");
  }

  // Verifica fim (apenas traidor descoberto ou todos os inocentes mortos)
  const tipoFim = verificarFim();
  if (tipoFim) { finalizar(tipoFim); return; }

  // Votação agendada
  const deveVotar = estado.dia >= 6 && estado.dia % estado.intervaloVotacao === 0 && vivos().length > 2;
  if (deveVotar) {
    abrirVotacao();
  }
}

// ============================================================
//  FIM (só termina se traidor descoberto ou todos os inocentes mortos)
// ============================================================
function verificarFim() {
  // Vitória: traidor eliminado por votação correta
  if (estado.traidorEliminadoPorVotacao) return "vitoria_traidor";

  // Derrota total: todos os inocentes mortos (só o traidor vivo)
  const inocentes = inocentesVivos();
  if (inocentes.length === 0) return "todos_inocentes_mortos";

  // Derrota total: ninguém vivo
  if (!vivos().length) return "todos_mortos";

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

  // Votos: jogador escolhe, NPCs votam pelo mais suspeito (ou no escolhido se afeto > 60)
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
    eliminado.status = "morto";
    estado.traidorEliminadoPorVotacao = true;
    logar(`🎉 VOCÊS ACERTARAM! ${eliminado.nome} era o traidor!`, "destaque");
    finalizar("vitoria_traidor");
    return;
  }

  eliminado.status = "morto";
  logar(`💔 ${eliminado.nome} era inocente. O traidor ainda está entre vocês...`, "morte");
  estado.votacoesFeitas++;

  renderStatus();

  const tipoFim = verificarFim();
  if (tipoFim) { finalizar(tipoFim); return; }

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
    <span class="tag-traidor">🗡️ Tentativas: ${t.tentativasAssassinato}</span>
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
  document.getElementById("btn-pular").classList.add("oculto");

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
    todos_inocentes_mortos: {
      titulo: "☠️ TODOS OS INOCENTES MORRERAM.",
      texto: `O traidor era ${estado.traidor.nome}. Ele(a) venceu. A ilha agora pertence a ele(a).`
    },
    todos_mortos: {
      titulo: "☠️ TODOS MORRERAM.",
      texto: "A ilha reivindicou todos vocês. Nenhuma história restou para contar."
    }
  };

  const f = finais[tipo] || { titulo: "Fim", texto: "" };
  logar(`\n🏁 FIM DE JOGO — ${f.titulo}\n${f.texto}`, "destaque");
}

// ============================================================
//  PULAR PARA O DESFECHO
// ============================================================
function pularParaDesfecho() {
  if (estado.fim) return;
  logar(`\n⏩ Acelerando o desfecho...`, "destaque");

  let seguranca = 0;
  while (!estado.fim && seguranca < 200) {
    seguranca++;
    passarDia();
    // Se uma votação abriu, resolvemos automaticamente escolhendo o mais suspeito
    const painelVotacao = document.getElementById("painel-votacao");
    if (!painelVotacao.classList.contains("oculto")) {
      const candidatos = vivos().filter(p => !p.isPlayer);
      if (candidatos.length) {
        const maisSuspeito = candidatos.reduce((a, b) => a.suspeita > b.suspeita ? a : b);
        resolverVotacao(maisSuspeito, candidatos);
      }
    }
  }
}

// ============================================================
//  TELA INICIAL
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

    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (i < 11) document.getElementById(`amigo-${i + 1}`)?.focus();
        else document.getElementById("btn-comecar").focus();
      }
    });

    wrap.appendChild(num);
    wrap.appendChild(inp);
    grid.appendChild(wrap);
  }
}

// ---------- localStorage ----------
function salvarConfig(nomeJogador, amigos, duracao) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nomeJogador, amigos, duracao }));
  } catch {}
}
function carregarConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const dados = JSON.parse(raw);
    document.getElementById("nome-jogador").value = dados.nomeJogador || "";
    (dados.amigos || []).forEach((n, i) => {
      const inp = document.getElementById(`amigo-${i + 1}`);
      if (inp) inp.value = n;
    });
    if (typeof dados.duracao === "number") {
      const d = clamp(dados.duracao, 10, 40);
      document.getElementById("input-dias").value = d;
      document.getElementById("dias-valor").textContent = d;
    }
  } catch {}
}

// ============================================================
//  INICIALIZAÇÃO
// ============================================================
function iniciar() {
  const nome = document.getElementById("nome-jogador").value.trim() || "Você";
  const duracao = parseInt(document.getElementById("input-dias").value, 10) || 25;

  const nomes = [];
  for (let i = 1; i <= 11; i++) {
    const inp = document.getElementById(`amigo-${i}`);
    if (!inp) continue;
    const v = inp.value.trim();
    if (v) nomes.push(v);
  }

  const aviso = document.getElementById("aviso-inicio");
  const unicos = [];
  nomes.forEach(n => {
    const igual = unicos.some(u => u.toLowerCase() === n.toLowerCase());
    const igualJogador = n.toLowerCase() === nome.toLowerCase();
    if (!igual && !igualJogador) unicos.push(n);
  });

  if (unicos.length < 2) {
    aviso.textContent = "⚠️ Digite pelo menos 2 nomes de amigos (é preciso ter alguém para votar e alguém para ser traidor).";
    return;
  }
  if (unicos.length < nomes.length) {
    aviso.textContent = "⚠️ Alguns nomes repetidos foram ignorados.";
  } else {
    aviso.textContent = "";
  }

  salvarConfig(nome, unicos, duracao);
  novoJogo(nome, unicos, duracao);

  document.getElementById("tela-inicio").classList.remove("ativa");
  document.getElementById("tela-jogo").classList.add("ativa");

  limparLog();
  logar(`🏝️ ${nome}, você e seus amigos estão presos na ilha.`, "destaque");
  logar(`🌑 Alguém entre vocês está planejando algo terrível...`, "destaque");
  logar(`👥 Grupo: ${estado.personagens.map(p => p.nome).join(", ")}`, "clima");
  logar(`⏳ A ilha não vai embora sozinha. O jogo só termina quando o traidor for eliminado por votação ou quando todos os inocentes morrerem.`, "clima");
  logar(`🗳️ Haverá votações a cada ${estado.intervaloVotacao} dias a partir do dia 6.`, "clima");

  renderCabecalho();
  renderStatus();

  document.getElementById("btn-proximo-dia").onclick = passarDia;
  document.getElementById("btn-proximo-dia").disabled = false;

  document.getElementById("btn-espiar").classList.remove("oculto");
  document.getElementById("btn-espiar").onclick = () => {
    if (estado.traidor) revelarTraidor();
  };

  document.getElementById("btn-pular").classList.remove("oculto");
  document.getElementById("btn-pular").onclick = pularParaDesfecho;
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
  document.getElementById("aviso-espectador").classList.add("oculto");

  document.getElementById("painel-traidor").classList.add("oculto");
  document.getElementById("traidor-info").innerHTML = "";
  document.getElementById("btn-espiar").classList.add("oculto");
  document.getElementById("btn-pular").classList.add("oculto");

  const btnInline = document.getElementById("btn-reiniciar-inline");
  if (btnInline) btnInline.remove();

  document.getElementById("painel-votacao").classList.add("oculto");
  document.getElementById("painel-votacao").innerHTML = "";

  carregarConfig();
}

// ============================================================
//  BOOTSTRAP
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  criarCamposAmigos();
  carregarConfig();

  const slider = document.getElementById("input-dias");
  const diasValor = document.getElementById("dias-valor");
  slider.addEventListener("input", () => {
    diasValor.textContent = slider.value;
  });

  document.getElementById("btn-comecar").onclick = iniciar;
  document.getElementById("btn-reiniciar").onclick = reiniciar;
});
