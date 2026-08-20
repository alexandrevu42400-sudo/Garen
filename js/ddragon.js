// ddragon.js — Accès en direct à l'API officielle Riot "Data Dragon".
// Toutes les données de champions (liste, images, skins) sont chargées à l'exécution
// depuis la dernière version publiée, donc l'app suit automatiquement chaque patch.

const VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";
const CDN = "https://ddragon.leagueoflegends.com/cdn";

let cache = {
  version: null,
  champions: null,      // { id: {id, key, name, title, tags, ...} }
  championList: null,   // array sorted by name
  normalizedIndex: null // Map<normalizedName, id>
};

/** Normalise un nom pour le matching (minuscule, sans accents, sans ponctuation). */
export function normalizeName(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // enleve les accents
    .replace(/[^a-z0-9]/g, ""); // enlève espaces, apostrophes, points, tirets...
}

async function getLatestVersion() {
  if (cache.version) return cache.version;
  try {
    const res = await fetch(VERSIONS_URL);
    const versions = await res.json();
    cache.version = versions[0];
  } catch (e) {
    console.warn("Impossible de récupérer la dernière version, repli sur une version connue.", e);
    cache.version = "14.1.1";
  }
  return cache.version;
}

/** Charge la liste complète des champions du patch courant. */
export async function loadChampions() {
  if (cache.championList) return cache.championList;
  const version = await getLatestVersion();
  const res = await fetch(`${CDN}/${version}/data/en_US/champion.json`);
  const data = await res.json();
  const champs = Object.values(data.data).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  cache.champions = data.data;
  cache.championList = champs;

  cache.normalizedIndex = new Map();
  for (const c of champs) {
    cache.normalizedIndex.set(normalizeName(c.id), c.id);
    cache.normalizedIndex.set(normalizeName(c.name), c.id);
  }
  // Quelques alias manuels pour les noms couramment orthographiés autrement.
  const aliases = {
    wukong: "MonkeyKing",
    monkeyking: "MonkeyKing",
    drmundo: "DrMundo",
    chogath: "Chogath",
    kogmaw: "KogMaw",
    ksante: "KSante",
    leesin: "LeeSin",
    jarvaniv: "JarvanIV",
    jarvan: "JarvanIV",
    tahmkench: "Tahm",
    reksai: "RekSai",
    velkoz: "Velkoz",
    khazix: "Khazix",
    belveth: "Belveth",
    nunu: "Nunu",
    twistedfate: "TwistedFate",
    xinzhao: "Xin",
    aurelionsol: "AurelionSol",
    missfortune: "MissFortune",
    masteryi: "MasterYi",
  };
  for (const [alias, id] of Object.entries(aliases)) {
    if (cache.championList.some((c) => c.id === id) && !cache.normalizedIndex.has(alias)) {
      cache.normalizedIndex.set(alias, id);
    }
  }

  return champs;
}

/** Retrouve l'id Data Dragon d'un champion à partir d'un nom approximatif ("Dr. Mundo", "K'Santé"...). */
export function findChampionId(name) {
  if (!cache.normalizedIndex) return null;
  return cache.normalizedIndex.get(normalizeName(name)) || null;
}

export function getChampion(id) {
  return cache.champions ? cache.champions[id] : null;
}

export function getChampionList() {
  return cache.championList || [];
}

export function getVersion() {
  return cache.version;
}

export function squareIconUrl(id) {
  return `${CDN}/${cache.version}/img/champion/${id}.png`;
}

export function splashUrl(id, skinNum = 0) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_${skinNum}.jpg`;
}

export function loadingUrl(id, skinNum = 0) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${id}_${skinNum}.jpg`;
}

/** Charge le détail d'un champion (dont la liste de ses skins) à la demande. */
const detailCache = new Map();
export async function loadChampionDetail(id) {
  if (detailCache.has(id)) return detailCache.get(id);
  const version = await getLatestVersion();
  const res = await fetch(`${CDN}/${version}/data/en_US/champion/${id}.json`);
  const data = await res.json();
  const detail = data.data[id];
  detailCache.set(id, detail);
  return detail;
}

export { getLatestVersion };
