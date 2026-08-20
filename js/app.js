// app.js — Logique principale de l'application.
import {
  loadChampions, getChampionList, getChampion, findChampionId,
  squareIconUrl, splashUrl, loadingUrl, loadChampionDetail, getVersion,
} from "./ddragon.js";
import { GAREN_MATCHUPS, RATING_META, GAREN_ABILITIES } from "./garenData.js";
import { analyzeTeamComp, buildRecommendations, genericMatchupTips, TAG_LABELS_FR } from "./heuristics.js";

const STORAGE_KEY = "lolcoach.settings.v1";

const state = {
  champions: [],
  garenIndex: new Map(), // normalizedEnemyName -> matchup entry
  settings: loadSettings(),
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupted storage */ }
  return { bgChampId: "Garen", bgSkinNum: 1, overlayOpacity: 0.65 };
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  } catch (e) { /* storage unavailable, fail silently */ }
}

// ---------- Init ----------
async function init() {
  setupTabs();
  const champs = await loadChampions();
  state.champions = champs;

  // Index des matchups Garen par nom normalisé de l'adversaire
  for (const m of GAREN_MATCHUPS) {
    const id = findChampionId(m.name);
    state.garenIndex.set(id || m.name.toLowerCase(), m);
  }

  document.getElementById("patch-badge").textContent = `Patch ${getVersion()} — données live`;

  renderChampionGrid(champs);
  setupRoleFilters(champs);
  setupSearch(champs);

  populateSelect(document.getElementById("my-champ-matchup"), champs, "Garen");
  populateSelect(document.getElementById("enemy-champ-matchup"), champs);
  populateSelect(document.getElementById("my-champ-build"), champs, "Garen");
  setupEnemyTeamGrid(champs);
  populateSelect(document.getElementById("bg-champ-select"), champs, state.settings.bgChampId);

  document.getElementById("my-champ-matchup").addEventListener("change", renderMatchup);
  document.getElementById("enemy-champ-matchup").addEventListener("change", renderMatchup);
  renderMatchup();

  document.getElementById("analyze-btn").addEventListener("click", renderBuildAnalysis);
  document.getElementById("my-champ-build").addEventListener("change", renderBuildAnalysis);
  renderBuildAnalysis();

  document.getElementById("bg-champ-select").addEventListener("change", onBgChampChange);
  document.getElementById("apply-bg-btn").addEventListener("click", applyBackground);
  document.getElementById("reset-bg-btn").addEventListener("click", resetBackground);
  document.getElementById("overlay-opacity").addEventListener("input", (e) => {
    document.getElementById("bg-overlay").style.setProperty("--overlay-opacity", e.target.value);
  });

  await onBgChampChange();
  applySavedBackground();
}

// ---------- Tabs ----------
function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });
}

function goToTab(tabName) {
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.click();
}

// ---------- Champion grid ----------
function renderChampionGrid(champs) {
  const grid = document.getElementById("champ-grid");
  grid.innerHTML = "";
  for (const c of champs) {
    const card = document.createElement("button");
    card.className = "champ-card";
    card.type = "button";
    card.dataset.tags = (c.tags || []).join(",");
    card.dataset.name = c.name.toLowerCase();
    card.innerHTML = `
      <img loading="lazy" src="${squareIconUrl(c.id)}" alt="${c.name}">
      <div class="champ-card-name">${c.name}</div>
      <div class="champ-card-title">${c.title}</div>
    `;
    card.addEventListener("click", () => {
      document.getElementById("my-champ-matchup").value = c.id;
      document.getElementById("my-champ-build").value = c.id;
      goToTab("matchup");
      renderMatchup();
    });
    grid.appendChild(card);
  }
}

function setupRoleFilters(champs) {
  const roles = ["Fighter", "Tank", "Mage", "Assassin", "Support", "Marksman"];
  const wrap = document.getElementById("role-filters");
  const allChip = document.createElement("button");
  allChip.className = "chip active";
  allChip.textContent = "Tous";
  allChip.dataset.role = "";
  wrap.appendChild(allChip);
  for (const role of roles) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = TAG_LABELS_FR[role] || role;
    chip.dataset.role = role;
    wrap.appendChild(chip);
  }
  wrap.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    wrap.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    filterGrid();
  });
}

function setupSearch(champs) {
  document.getElementById("champ-search").addEventListener("input", filterGrid);
}

function filterGrid() {
  const query = document.getElementById("champ-search").value.trim().toLowerCase();
  const activeChip = document.querySelector("#role-filters .chip.active");
  const role = activeChip ? activeChip.dataset.role : "";
  document.querySelectorAll(".champ-card").forEach((card) => {
    const matchesQuery = !query || card.dataset.name.includes(query);
    const matchesRole = !role || card.dataset.tags.split(",").includes(role);
    card.style.display = matchesQuery && matchesRole ? "" : "none";
  });
}

// ---------- Selects ----------
function populateSelect(select, champs, defaultId) {
  select.innerHTML = "";
  for (const c of champs) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  }
  if (defaultId && champs.some((c) => c.id === defaultId)) select.value = defaultId;
}

function setupEnemyTeamGrid(champs) {
  const grid = document.getElementById("enemy-team-grid");
  grid.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const wrap = document.createElement("div");
    wrap.className = "picker enemy-slot";
    const label = document.createElement("label");
    label.textContent = `Adverse ${i + 1}`;
    label.htmlFor = `enemy-slot-${i}`;
    const select = document.createElement("select");
    select.id = `enemy-slot-${i}`;
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "— (vide) —";
    select.appendChild(emptyOpt);
    for (const c of champs) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    }
    select.addEventListener("change", renderBuildAnalysis);
    wrap.appendChild(label);
    wrap.appendChild(select);
    grid.appendChild(wrap);
  }
}

// ---------- Matchup tab ----------
function renderMatchup() {
  const myId = document.getElementById("my-champ-matchup").value;
  const enemyId = document.getElementById("enemy-champ-matchup").value;
  const myChamp = getChampion(myId);
  const enemyChamp = getChampion(enemyId);
  const container = document.getElementById("matchup-result");
  if (!myChamp || !enemyChamp) { container.innerHTML = ""; return; }

  if (myId === "Garen") {
    const entry = state.garenIndex.get(enemyId);
    if (entry) {
      container.innerHTML = renderGarenCard(entry, enemyChamp);
      return;
    }
  }

  // Repli générique
  const tips = genericMatchupTips(myChamp, enemyChamp);
  container.innerHTML = `
    <div class="result-card generic-card">
      <div class="result-head">
        <img src="${squareIconUrl(myChamp.id)}" alt="${myChamp.name}">
        <span class="vs">vs</span>
        <img src="${squareIconUrl(enemyChamp.id)}" alt="${enemyChamp.name}">
        <div>
          <h2>${myChamp.name} vs ${enemyChamp.name}</h2>
          <span class="badge badge-neutral">Conseils génériques</span>
        </div>
      </div>
      <p class="notice">${myId === "Garen"
        ? "Ce champion adverse n'a pas encore de guide détaillé écrit à la main dans la base Garen. Voici des conseils génériques basés sur son profil :"
        : "Seul Garen dispose actuellement d'un guide de matchup détaillé écrit à la main. Voici des conseils génériques basés sur les classes des deux champions :"}</p>
      <ul class="tip-list">
        ${tips.map((t) => `<li>${t}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderGarenCard(entry, enemyChamp) {
  const meta = RATING_META[entry.rating] || { label: entry.rating, color: "#999" };
  return `
    <div class="result-card garen-card">
      <div class="result-head">
        <img src="${squareIconUrl("Garen")}" alt="Garen">
        <span class="vs">vs</span>
        <img src="${squareIconUrl(enemyChamp.id)}" alt="${enemyChamp.name}">
        <div>
          <h2>Garen vs ${enemyChamp.name}</h2>
          <span class="badge" style="--badge-color:${meta.color}">${meta.label}</span>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat"><span class="stat-label">Difficulté de lane</span><span class="stat-value">${entry.laning}</span></div>
        <div class="stat"><span class="stat-label">Sorts d'invocateur</span><span class="stat-value">${entry.summoners}</span></div>
        <div class="stat"><span class="stat-label">Objet de départ</span><span class="stat-value">${entry.starterItem}</span></div>
      </div>

      <div class="skill-order-row">
        <div>
          <span class="stat-label">Ordre de compétences</span>
          <div class="skill-order">${renderSkillOrder(entry.skillOrder)}</div>
        </div>
        <div>
          <span class="stat-label">Alternative</span>
          <div class="skill-order alt">${renderSkillOrder(entry.altSkillOrder)}</div>
        </div>
      </div>

      <div class="advice-block">
        <h3>Astuces</h3>
        <p>${entry.tips}</p>
      </div>
      <div class="advice-block">
        <h3>Comment jouer le matchup</h3>
        <p>${entry.howTo}</p>
      </div>

      ${entry.video ? `<a class="video-link" href="${entry.video}" target="_blank" rel="noopener">▶ Voir une vidéo pédagogique de ce matchup</a>` : ""}
    </div>
  `;
}

function renderSkillOrder(order) {
  if (!order) return "";
  return order
    .split(">")
    .map((s) => s.trim())
    .map((letter) => {
      const full = GAREN_ABILITIES[letter] || letter;
      return `<span class="skill-pill" title="${full}">${letter}</span>`;
    })
    .join('<span class="skill-arrow">→</span>');
}

// ---------- Build tab ----------
function renderBuildAnalysis() {
  const myId = document.getElementById("my-champ-build").value;
  const myChamp = getChampion(myId);
  const enemyIds = [];
  for (let i = 0; i < 5; i++) {
    const v = document.getElementById(`enemy-slot-${i}`).value;
    if (v) enemyIds.push(v);
  }
  const enemyChamps = enemyIds.map(getChampion).filter(Boolean);
  const container = document.getElementById("build-result");

  if (enemyChamps.length === 0) {
    container.innerHTML = `<p class="notice">Sélectionne au moins un champion adverse ci-dessus — l'analyse se met à jour automatiquement (le bouton "Analyser" fonctionne aussi si tu préfères).</p>`;
    return;
  }

  const analysis = analyzeTeamComp(enemyChamps);
  const recos = buildRecommendations(analysis);

  // Si on joue Garen et qu'un adversaire a un guide détaillé, on le met en avant.
  let garenHighlight = "";
  if (myId === "Garen") {
    const matched = enemyChamps
      .map((c) => ({ c, entry: state.garenIndex.get(c.id) }))
      .filter((x) => x.entry);
    if (matched.length) {
      garenHighlight = `
        <div class="result-card">
          <h3>Guides de matchup détaillés disponibles dans cette compo</h3>
          <ul class="tip-list">
            ${matched.map(({ c, entry }) => {
              const meta = RATING_META[entry.rating];
              return `<li><strong>${c.name}</strong> — <span class="badge inline" style="--badge-color:${meta.color}">${meta.label}</span> · va voir l'onglet "Coach de matchup" pour le détail complet.</li>`;
            }).join("")}
          </ul>
        </div>`;
    }
  }

  container.innerHTML = `
    <div class="result-card">
      <div class="result-head compact">
        <img src="${squareIconUrl(myChamp.id)}" alt="${myChamp.name}">
        <h2>Build recommandé pour ${myChamp.name} face à cette compo</h2>
      </div>
      <div class="enemy-icons">
        ${enemyChamps.map((c) => `<img src="${squareIconUrl(c.id)}" alt="${c.name}" title="${c.name}">`).join("")}
      </div>
      <ul class="tip-list">
        ${recos.map((r) => `<li>${r}</li>`).join("")}
      </ul>
      <p class="disclaimer">Ces recommandations sont des heuristiques générales basées sur les classes de champions (dégâts, CC, sustain, burst) — pense à les combiner avec ton propre bon sens et l'évolution de la partie.</p>
    </div>
    ${garenHighlight}
  `;
}

// ---------- Appearance tab ----------
async function onBgChampChange() {
  const champId = document.getElementById("bg-champ-select").value;
  const detail = await loadChampionDetail(champId);
  const skinSelect = document.getElementById("bg-skin-select");
  skinSelect.innerHTML = "";
  (detail?.skins || []).forEach((skin) => {
    const opt = document.createElement("option");
    opt.value = skin.num;
    opt.textContent = skin.name === "default" ? detail.name : skin.name;
    skinSelect.appendChild(opt);
  });
  skinSelect.onchange = updateBgPreview;
  updateBgPreview();
}

function updateBgPreview() {
  const champId = document.getElementById("bg-champ-select").value;
  const skinNum = document.getElementById("bg-skin-select").value || 0;
  document.getElementById("bg-preview").src = splashUrl(champId, skinNum);
}

function applyBackground() {
  const champId = document.getElementById("bg-champ-select").value;
  const skinNum = Number(document.getElementById("bg-skin-select").value || 0);
  const opacity = Number(document.getElementById("overlay-opacity").value);
  state.settings = { bgChampId: champId, bgSkinNum: skinNum, overlayOpacity: opacity };
  saveSettings();
  applySavedBackground();
}

function resetBackground() {
  state.settings = { bgChampId: "Garen", bgSkinNum: 1, overlayOpacity: 0.65 };
  saveSettings();
  document.getElementById("bg-champ-select").value = "Garen";
  onBgChampChange().then(() => {
    document.getElementById("bg-skin-select").value = "1";
    applySavedBackground();
  });
}

function applySavedBackground() {
  const { bgChampId, bgSkinNum, overlayOpacity } = state.settings;
  document.getElementById("bg-layer").style.backgroundImage = `url(${splashUrl(bgChampId, bgSkinNum)})`;
  document.getElementById("bg-overlay").style.setProperty("--overlay-opacity", overlayOpacity);
  document.getElementById("overlay-opacity").value = overlayOpacity;
}

init().catch((err) => {
  console.error(err);
  document.getElementById("champ-grid").innerHTML =
    `<p class="loading">Impossible de charger les données Data Dragon en direct (connexion réseau ?). Réessaie plus tard.</p>`;
});
