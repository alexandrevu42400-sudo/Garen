// heuristics.js — Moteur de conseils génériques.
// Utilisé (1) comme repli pour les matchups qui n'ont pas encore de guide détaillé écrit à la main,
// et (2) pour l'analyse de composition adverse dans l'onglet "Compo & Build".
// Ce sont des heuristiques basées sur les classes/tags Riot + quelques listes maison,
// pas une base de données exhaustive : elles donnent une direction, pas une vérité absolue.

import { normalizeName } from "./ddragon.js";

export const TAG_LABELS_FR = {
  Fighter: "Combattant",
  Tank: "Tank",
  Mage: "Mage",
  Assassin: "Assassin",
  Support: "Support",
  Marksman: "Tireur",
};

// Listes maison (approximatives, basées sur des kits connus) pour affiner l'analyse au-delà des tags Riot.
const HARD_CC_CHAMPS = [
  "malphite","amumu","leona","nautilus","sejuani","ashe","lux","morgana","blitzcrank","thresh",
  "rakan","alistar","taric","braum","nunu","skarner","rammus","zac","poppy","sion","galio","neeko",
  "pantheon","wukong","monkeyking","jarvaniv","vi","rell","gragas","volibear","trundle","warwick",
  "maokai","hecarim","sett","ornn","zyra","annie","fiddlesticks","elise","evelynn","shen",
];
const HIGH_SUSTAIN_CHAMPS = [
  "warwick","vladimir","aatrox","drmundo","soraka","yuumi","volibear","swain","briar","trundle",
  "nasus","fiora","irelia","gragas",
];
const BURST_DIVE_CHAMPS = [
  "zed","talon","akali","katarina","fizz","kassadin","ekko","qiyana","naafiri","kayn","leblanc",
  "evelynn","rengar","nocturne","khazix","pyke","elise","akshan",
];

function has(list, name) {
  return list.includes(normalizeName(name));
}

/** Analyse une liste de champions adverses (objets ddragon: id, name, tags[]) et renvoie des métriques. */
export function analyzeTeamComp(enemyChamps) {
  const tagCounts = {};
  let apLeaning = 0;
  let adLeaning = 0;
  let hardCc = 0;
  let sustain = 0;
  let diveRisk = 0;

  for (const champ of enemyChamps) {
    if (!champ) continue;
    for (const tag of champ.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
    if ((champ.tags || []).includes("Mage") || (champ.tags || []).includes("Support")) apLeaning++;
    if ((champ.tags || []).some((t) => ["Marksman", "Assassin", "Fighter", "Tank"].includes(t))) adLeaning++;
    if (has(HARD_CC_CHAMPS, champ.id) || has(HARD_CC_CHAMPS, champ.name)) hardCc++;
    if (has(HIGH_SUSTAIN_CHAMPS, champ.id) || has(HIGH_SUSTAIN_CHAMPS, champ.name)) sustain++;
    if (has(BURST_DIVE_CHAMPS, champ.id) || has(BURST_DIVE_CHAMPS, champ.name)) diveRisk++;
  }

  return { tagCounts, apLeaning, adLeaning, hardCc, sustain, diveRisk, count: enemyChamps.filter(Boolean).length };
}

/** Construit une liste de recommandations de build en français à partir de l'analyse de compo. */
export function buildRecommendations(analysis) {
  const recos = [];
  if (analysis.count === 0) {
    return ["Sélectionne au moins un champion adverse pour obtenir des recommandations."];
  }

  if (analysis.apLeaning >= 2 && analysis.apLeaning > analysis.adLeaning) {
    recos.push("La compo adverse est plutôt orientée dégâts magiques : priorise la résistance magique un peu plus tôt que d'habitude (Robe de laine, Larme de bandit, ou objet MR complet selon ton rôle).");
  } else if (analysis.adLeaning >= 3) {
    recos.push("La compo adverse est plutôt orientée dégâts physiques : l'armure sera généralement plus rentable que la résistance magique.");
  } else {
    recos.push("Les dégâts adverses sont mixtes (physique/magique) : garde une build flexible et adapte-toi objet par objet selon qui te fait le plus mal en jeu.");
  }

  if (analysis.hardCc >= 2) {
    recos.push(`Compo avec beaucoup de crowd control (${analysis.hardCc} source${analysis.hardCc > 1 ? "s" : ""} détectée${analysis.hardCc > 1 ? "s" : ""}) : envisage des Bottes au mercure, une Cape de Banshee/QSS, ou un objet actif de purge selon ton champion.`);
  }

  if (analysis.sustain >= 1) {
    recos.push(`La compo adverse contient du sustain important : pense à un objet "Guérison réduite" (Exécuteur, Morellonomicon, Larme et Chaux Corrosive selon ton rôle) pour limiter leur régénération.`);
  }

  if (analysis.diveRisk >= 2) {
    recos.push("Plusieurs menaces de dive/burst rapide en face : reste prudent sur ton positionnement en river/side lane, et envisage un objet défensif actif (Zhonya, Stoneplate) pour survivre au premier engage.");
  }

  if (analysis.tagCounts["Marksman"] >= 1 && analysis.tagCounts["Support"] >= 1) {
    recos.push("La bot lane adverse semble classique (tireur + support) : attention à leur portée en poke pré-6 si tu passes par là en roam.");
  }

  if (recos.length === 1) {
    recos.push("Compo adverse relativement équilibrée : construis ta build de base habituelle et ajuste en fonction de qui inflige le plus de dégâts en cours de partie.");
  }

  return recos;
}

/** Conseils de matchup génériques (repli) pour un champion sans guide détaillé, basés sur les classes des deux champions. */
export function genericMatchupTips(myChamp, enemyChamp) {
  const tips = [];
  const enemyTags = enemyChamp?.tags || [];
  const myTags = myChamp?.tags || [];

  if (enemyTags.includes("Assassin") || has(BURST_DIVE_CHAMPS, enemyChamp?.id)) {
    tips.push("Cet adversaire est un profil assassin/burst : évite de te faire isoler, joue prudent hors vision et garde un œil sur les moments où ses sorts clés sont en cooldown pour trader.");
  }
  if (enemyTags.includes("Mage")) {
    tips.push("Cet adversaire est un mage : attends que ses sorts de poke soient utilisés avant d'avancer pour trader, et évite de rester statique sous son harass.");
  }
  if (enemyTags.includes("Marksman")) {
    tips.push("Cet adversaire est un tireur : profite de ton avantage au corps-à-corps en early avant que son scaling ne prenne le dessus, surtout avant qu'il n'ait ses premiers objets.");
  }
  if (enemyTags.includes("Tank")) {
    tips.push("Cet adversaire est un tank : ne perds pas de temps à vouloir le tuer en lane, privilégie le farm, le contrôle de wave et l'impact sur la carte plutôt que le duel pur.");
  }
  if (enemyTags.includes("Fighter")) {
    tips.push("Cet adversaire est un combattant polyvalent : le matchup se jouera sur le timing des cooldowns et le spacing plus que sur un seul gros combo.");
  }
  if (enemyTags.includes("Support") && !enemyTags.includes("Mage") && !enemyTags.includes("Tank")) {
    tips.push("Cet adversaire est plutôt un profil support/utilitaire hors de son rôle habituel : ses dégâts bruts seront limités, cherche à le punir agressivement en early.");
  }

  if (myTags.includes("Tank")) {
    tips.push("En tant que tank, ton objectif de lane est surtout de survivre et de préparer le mid-game : ne cherche pas le kill à tout prix, absorbe les ressources ennemies.");
  } else if (myTags.includes("Assassin")) {
    tips.push("En tant qu'assassin, cherche tes fenêtres de burst plutôt que les trades prolongés : joue autour des cooldowns de l'adversaire.");
  }

  if (tips.length === 0) {
    tips.push("Aucune donnée spécifique pour ce duel pour l'instant — joue autour des cooldowns, du farm et évite les trades prolongés désavantageux.");
  }
  tips.push("Ce conseil est généré automatiquement à partir des classes des champions (pas encore un guide détaillé écrit à la main).");
  return tips;
}
