const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const ui = {
  phase: document.getElementById("phase"),
  order: document.getElementById("turnOrder"),
  unit: document.getElementById("unitInfo"),
  terrain: document.getElementById("terrainInfo"),
  commands: document.getElementById("commands"),
  prediction: document.getElementById("prediction"),
  log: document.getElementById("log")
};

const TILE = 56;
const MAP_X = 22;
const MAP_Y = 38;
const DIRS = [
  { x: 1, y: 0, facing: "right" },
  { x: -1, y: 0, facing: "left" },
  { x: 0, y: 1, facing: "down" },
  { x: 0, y: -1, facing: "up" }
];
const FLANK = { front: 1, side: 1.15, back: 1.35 };
const SAVE_PREFIX = "gridbound_tactics_save_v1_slot_";
const SAVE_SLOT_COUNT = 3;

let data;
let units = [];
let current = null;
let mode = "loading";
let activeAction = null;
let reachable = new Map();
let targetTiles = new Set();
let hoverTile = null;
let battleOver = false;
let messages = [];
let inventory = {};
let weaponInventory = {};
let equipmentInventory = {};
let gold = null;
let storyFlags = {};
let spriteAssets = {};
let cutinAssets = {};
let cutin = null;
let floatTexts = [];
let battleStats = null;
let portraitAssets = {};
let scenarioState = null;
let pendingResultMode = null;
let partyIndex = 0;
let returnMode = "briefing";
let saveSlot = 1;
let weaponProficiency = {};
let partyTreeIndex = 0;
let confirmDialog = null;
let townId = "stoneford";
let townCursor = 0;
let shopId = null;
let shopCursor = 0;
let dungeonCursor = 0;
let selectedDungeonId = null;
let chapterCursor = 0;
let activeChapterId = null;
let maxUnlockedChapter = 1;
let completedChapters = {};

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

async function boot() {
  data = {
    terrain: await loadJson("../data/terrain.json"),
    map: await loadJson("../data/map.json"),
    maps: await loadJson("../data/maps.json"),
    chapters: await loadJson("../data/chapters.json"),
    weapons: await loadJson("../data/weapons.json"),
    skills: await loadJson("../data/skills.json"),
    characters: await loadJson("../data/characters.json"),
    items: await loadJson("../data/items.json"),
    equipment: await loadJson("../data/equipment.json"),
    skilltrees: await loadJson("../data/skilltrees.json"),
    sprites: await loadJson("../data/sprites.json"),
    cutins: await loadJson("../data/cutins.json"),
    scenario: await loadJson("../data/scenario.json"),
    locations: await loadJson("../data/locations.json"),
    shops: await loadJson("../data/shops.json"),
    portraits: await loadJson("../data/portraits.json"),
    progression: await loadJson("../data/progression.json")
  };
  data.defaultMap = data.map;
  spriteAssets = await loadImageAssets(data.sprites.units);
  cutinAssets = await loadImageAssets(data.cutins.units);
  portraitAssets = await loadImageAssets(data.portraits.portraits);
  const params = new URLSearchParams(window.location.search);
  const previewRoute = params.get("route");
  const routeExists = townData().dungeons.some(route => route.id === previewRoute);
  if (previewRoute && routeExists) {
    selectedDungeonId = previewRoute;
    startNewBattle();
    if (params.get("mode") === "battle") beginBattle();
  } else {
    startScenario(data.scenario.startScene || "opening");
  }
  requestAnimationFrame(draw);
}

async function loadImageAssets(definitions = {}) {
  const loaded = {};
  await Promise.all(Object.entries(definitions).map(([id, def]) => new Promise(resolve => {
    const path = def.path || def.imagePath;
    if (!path) {
      loaded[id] = { ...def, image: null };
      resolve();
      return;
    }
    const image = new Image();
    image.onload = () => {
      loaded[id] = { ...def, image };
      resolve();
    };
    image.onerror = () => {
      loaded[id] = { ...def, image: null };
      resolve();
    };
    image.src = path;
  })));
  return loaded;
}

function startNewBattle() {
  ensureCampaignState();
  data.map = activeBattleMap();
  const dungeon = selectedDungeon();
  const allies = data.characters.allies.map(source => prepareBattleAlly(partyMembers().find(unit => unit.id === source.id) || createUnit(source), source, dungeon?.allyStart?.[source.id]));
  const enemies = routeEnemies(dungeon).map(createUnit);
  units = [...allies, ...enemies];
  current = null;
  mode = "briefing";
  activeAction = null;
  reachable.clear();
  targetTiles.clear();
  hoverTile = null;
  battleOver = false;
  messages = [];
  cutin = null;
  floatTexts = [];
  pendingResultMode = null;
  battleStats = {
    startedAt: null,
    endedAt: null,
    actions: 0,
    outcome: null
  };
  log("Review the objective, then start battle.");
  renderUi();
}

function activeBattleMap() {
  const mapId = selectedDungeon()?.mapId;
  return data.maps?.[mapId] || data.defaultMap;
}

function routeEnemies(dungeon) {
  if (!dungeon?.enemies?.length) return data.characters.enemies;
  return dungeon.enemies.map(entry => {
    const base = data.characters.enemies.find(enemy => enemy.id === entry.id);
    return base ? { ...base, ...entry } : entry;
  });
}

function ensureCampaignState() {
  if (!Object.keys(inventory).length) inventory = Object.fromEntries(Object.entries(data.items).map(([id, item]) => [id, item.quantity || 0]));
  if (!Object.keys(weaponInventory).length) weaponInventory = structuredClone(data.progression.weaponInventory || {});
  if (!Object.keys(equipmentInventory).length) equipmentInventory = structuredClone(data.progression.equipmentInventory || {});
  if (!Object.keys(weaponProficiency).length) weaponProficiency = Object.fromEntries(data.characters.allies.map(unit => [unit.id, {}]));
  if (!units.some(unit => unit.team === "ally")) units = data.characters.allies.map(createUnit);
  if (gold === null) gold = data.progression.gold || 0;
}

function prepareBattleAlly(unit, source, start = null) {
  recalcUnitStats(unit);
  return {
    ...unit,
    team: "ally",
    x: start?.x ?? source.x,
    y: start?.y ?? source.y,
    facing: start?.facing || source.facing || "right",
    initiative: 0,
    acted: false,
    moved: false,
    dead: unit.hp <= 0
  };
}

function startScenario(sceneId, afterScene = null) {
  const scene = data.scenario.scenes[sceneId];
  if (!scene) {
    if (afterScene === "result") {
      mode = pendingResultMode || "victory";
      renderUi();
    } else if (afterScene === "town") {
      enterTown();
    } else {
      startNewBattle();
    }
    return;
  }
  mode = "scenario";
  scenarioState = {
    sceneId,
    scene,
    index: 0,
    afterScene: afterScene || scene.next
  };
  activeAction = null;
  reachable.clear();
  targetTiles.clear();
  hoverTile = null;
  renderUi();
}

function advanceScenario() {
  if (mode !== "scenario" || !scenarioState) return;
  scenarioState.index += 1;
  if (scenarioState.index < scenarioState.scene.lines.length) {
    renderUi();
    return;
  }
  const next = scenarioState.afterScene;
  scenarioState = null;
  if (next === "battle") {
    startNewBattle();
  } else if (next === "town") {
    enterTown();
  } else if (next === "result") {
    mode = pendingResultMode || "victory";
    pendingResultMode = null;
    renderUi();
  } else if (next && data.scenario.scenes[next]) {
    startScenario(next);
  } else {
    startNewBattle();
  }
}

function enterTown(id = townId) {
  ensureCampaignState();
  townId = id;
  units = partyMembers();
  mode = "town";
  current = null;
  activeAction = null;
  reachable.clear();
  targetTiles.clear();
  confirmDialog = null;
  battleOver = false;
  pendingResultMode = null;
  log(`Arrived at ${townData().name}.`);
  renderUi();
}

function townData() {
  return data.locations.towns[townId];
}

function selectedTownNpc() {
  const npcs = townData().npcs || [];
  return npcs[townCursor % Math.max(1, npcs.length)] || null;
}

function cycleTownNpc() {
  const npcs = townData().npcs || [];
  if (!npcs.length) return;
  townCursor = (townCursor + 1) % npcs.length;
  renderUi();
}

function talkTownNpc() {
  const npc = selectedTownNpc();
  if (!npc) return;
  if (npc.flag) storyFlags[npc.flag] = true;
  if (npc.scene) startScenario(npc.scene, "town");
  else log(`${npc.name}: ${npc.text || "..."}`);
}

function enterShop(id = townData().shopId) {
  ensureCampaignState();
  if (!id || !data.shops[id]) return;
  shopId = id;
  shopCursor = 0;
  mode = "shop";
  log(`Opened ${shopData().name}.`);
  renderUi();
}

function shopData() {
  return data.shops[shopId];
}

function nextShopItem() {
  const stock = shopData()?.stock || [];
  if (!stock.length) return;
  shopCursor = (shopCursor + 1) % stock.length;
  renderUi();
}

function buyShopItem() {
  const item = (shopData()?.stock || [])[shopCursor];
  if (!item) return;
  if (gold < item.price) {
    log("Not enough gold.");
    return;
  }
  gold -= item.price;
  addInventoryItem(item);
  log(`Bought ${shopItemName(item)} for ${item.price}G.`);
  renderUi();
}

function addInventoryItem(item) {
  if (item.type === "item") inventory[item.id] = (inventory[item.id] || 0) + (item.quantity || 1);
  if (item.type === "weapon") weaponInventory[item.id] = (weaponInventory[item.id] || 0) + (item.quantity || 1);
  if (item.type === "armor" || item.type === "accessory") {
    equipmentInventory[item.type] = equipmentInventory[item.type] || {};
    equipmentInventory[item.type][item.id] = (equipmentInventory[item.type][item.id] || 0) + (item.quantity || 1);
  }
}

function shopItemName(item) {
  if (item.type === "item") return data.items[item.id]?.name || item.id;
  if (item.type === "weapon") return data.weapons[item.id]?.name || item.id;
  return equipmentName(item.id);
}

function useInn() {
  const inn = townData().inn;
  if (!inn) return;
  if (gold < inn.cost) {
    log("Not enough gold for the inn.");
    return;
  }
  gold -= inn.cost;
  for (const unit of partyMembers()) {
    recalcUnitStats(unit);
    unit.hp = unit.stats.maxHp;
    unit.mp = unit.stats.maxMp;
    unit.dead = false;
  }
  log(`Rested at ${inn.name} for ${inn.cost}G.`);
  renderUi();
}

function enterDungeon() {
  ensureCampaignState();
  dungeonCursor = clamp(dungeonCursor, 0, (townData().dungeons || []).length - 1);
  mode = "dungeon";
  log("Choose a dungeon route.");
  renderUi();
}

function nextDungeon() {
  const dungeons = townData().dungeons || [];
  if (!dungeons.length) return;
  dungeonCursor = (dungeonCursor + 1) % dungeons.length;
  renderUi();
}

function startSelectedDungeon() {
  const dungeon = (townData().dungeons || [])[dungeonCursor];
  if (!dungeon) return;
  activeChapterId = null;
  selectedDungeonId = dungeon.id;
  if (dungeon.scene) startScenario(dungeon.scene, "battle");
  else startNewBattle();
}

function selectedDungeon() {
  return (townData().dungeons || []).find(dungeon => dungeon.id === selectedDungeonId) || null;
}

function enterChapterSelect() {
  ensureCampaignState();
  chapterCursor = clamp(chapterCursor, 0, availableChapters().length - 1);
  mode = "chapter";
  log("Choose a story chapter.");
  renderUi();
}

function chapterList() {
  return data.chapters.chapters || [];
}

function availableChapters() {
  return chapterList().filter(chapter => chapter.number <= maxUnlockedChapter);
}

function selectedChapter() {
  return availableChapters()[chapterCursor] || availableChapters()[0] || null;
}

function activeChapter() {
  return chapterList().find(chapter => chapter.id === activeChapterId) || null;
}

function nextChapter() {
  const chapters = availableChapters();
  if (!chapters.length) return;
  chapterCursor = (chapterCursor + 1) % chapters.length;
  renderUi();
}

function startSelectedChapter() {
  const chapter = selectedChapter();
  if (!chapter) return;
  activeChapterId = chapter.id;
  selectedDungeonId = chapter.dungeonId;
  const dungeon = selectedDungeon();
  if (!dungeon) {
    log(`Chapter ${chapter.number} has no dungeon route.`);
    return;
  }
  log(`Chapter ${chapter.number}: ${chapter.title}`);
  startScenario(chapter.storyScene || dungeon.scene, "battle");
}

function completeActiveChapter() {
  const chapter = activeChapter();
  if (!chapter || completedChapters[chapter.id]) return;
  completedChapters[chapter.id] = true;
  grantChapterReward(chapter);
  if (chapter.unlocksChapter) maxUnlockedChapter = Math.max(maxUnlockedChapter, chapter.unlocksChapter);
  if (chapter.endingScene) storyFlags.finalEndingReady = true;
}

function grantChapterReward(chapter) {
  const reward = chapter.reward || {};
  if (reward.gold) gold += reward.gold;
  for (const item of reward.items || []) addInventoryItem(item);
  log(`Chapter clear reward: ${reward.gold || 0}G${(reward.items || []).length ? " and supplies" : ""}.`);
}

function beginBattle() {
  if (mode !== "briefing") return;
  battleStats.startedAt = Date.now();
  log("Battle start: rout all enemies.");
  nextUnit();
}

function openParty() {
  if (!units.length) return;
  returnMode = mode;
  mode = "party";
  confirmDialog = null;
  partyIndex = clamp(partyIndex, 0, partyMembers().length - 1);
  activeAction = null;
  reachable.clear();
  targetTiles.clear();
  renderUi();
}

function closeParty() {
  confirmDialog = null;
  mode = returnMode || "briefing";
  renderUi();
}

function partyMembers() {
  return units.filter(u => u.team === "ally");
}

function selectedPartyMember() {
  return partyMembers()[partyIndex] || partyMembers()[0] || null;
}

function nextPartyMember() {
  const members = partyMembers();
  if (!members.length) return;
  confirmDialog = null;
  partyIndex = (partyIndex + 1) % members.length;
  partyTreeIndex = 0;
  renderUi();
}

function skillTreeEntries(unit) {
  const tree = data.skilltrees[unit?.class];
  return tree ? Object.entries(tree.nodes).map(([id, node]) => ({ id, node })) : [];
}

function nextSkillNode() {
  const entries = skillTreeEntries(selectedPartyMember());
  if (!entries.length) return;
  confirmDialog = null;
  partyTreeIndex = (partyTreeIndex + 1) % entries.length;
  renderUi();
}

function trainSelectedSkillNode() {
  const unit = selectedPartyMember();
  const entry = skillTreeEntries(unit)[partyTreeIndex];
  if (!unit || !entry) return;
  if (!availableSkillNodes(unit).some(item => item.id === entry.id)) {
    log(`${entry.node.name} is not available yet.`);
    return;
  }
  confirmDialog = {
    kind: "skill",
    unitId: unit.id,
    nodeId: entry.id
  };
  renderUi();
}

function confirmSkillUnlock() {
  if (!confirmDialog || confirmDialog.kind !== "skill") return;
  const unit = units.find(u => u.id === confirmDialog.unitId);
  const nodeId = confirmDialog.nodeId;
  confirmDialog = null;
  if (!unit || !availableSkillNodes(unit).some(item => item.id === nodeId)) {
    log("Skill unlock is no longer available.");
    renderUi();
    return;
  }
  unlockSkillNode(unit, nodeId);
}

function cancelConfirmDialog() {
  confirmDialog = null;
  renderUi();
}

function equipNext(slot) {
  const unit = selectedPartyMember();
  const choices = inventoryIds(equipmentInventory[slot]);
  if (!unit || !choices.length) return;
  confirmDialog = null;
  const currentId = unit.equipment?.[slot] || choices[0];
  const nextIndex = (choices.indexOf(currentId) + 1) % choices.length;
  unit.equipment = { ...(unit.equipment || {}), [slot]: choices[nextIndex] };
  recalcUnitStats(unit);
  log(`${unit.name} equips ${equipmentName(choices[nextIndex])}.`);
  renderUi();
}

function equipNextWeapon() {
  const unit = selectedPartyMember();
  const choices = compatibleWeapons(unit);
  if (!unit || !choices.length) return;
  confirmDialog = null;
  const currentIndex = choices.indexOf(unit.weapon);
  const nextId = choices[(currentIndex + 1 + choices.length) % choices.length];
  unit.weapon = nextId;
  recalcUnitStats(unit);
  log(`${unit.name} equips ${weaponOf(unit).name}.`);
  renderUi();
}

function compatibleWeapons(unit) {
  if (!unit) return [];
  const inventoryWeapons = inventoryIds(weaponInventory).length ? inventoryIds(weaponInventory) : Object.keys(data.weapons);
  const allowed = classWeaponTags(unit.class);
  return inventoryWeapons.filter(id => {
    const weapon = data.weapons[id];
    if (!weapon) return false;
    if (!allowed.length) return true;
    return (weapon.tags || []).some(tag => allowed.includes(tag));
  });
}

function nextWeaponId(unit) {
  const choices = compatibleWeapons(unit);
  if (!unit || !choices.length) return null;
  const currentIndex = choices.indexOf(unit.weapon);
  return choices[(currentIndex + 1 + choices.length) % choices.length];
}

function nextEquipmentId(unit, slot) {
  const choices = inventoryIds(equipmentInventory[slot]);
  if (!unit || !choices.length) return null;
  const currentId = unit.equipment?.[slot] || choices[0];
  const nextIndex = (choices.indexOf(currentId) + 1) % choices.length;
  return choices[nextIndex];
}

function previewStats(unit, changes = {}) {
  const preview = {
    ...unit,
    weapon: changes.weapon ?? unit.weapon,
    equipment: { ...(unit.equipment || {}), ...(changes.equipment || {}) }
  };
  return buildStats(preview);
}

function statDeltaLine(currentStats, nextStats, stats = ["attack", "defense", "magic", "magicDefense", "speed", "accuracy", "evasion", "movement"]) {
  const labels = {
    maxHp: "HP",
    maxMp: "MP",
    attack: "ATK",
    defense: "DEF",
    magic: "MAG",
    magicDefense: "MDF",
    speed: "SPD",
    accuracy: "ACC",
    evasion: "EVA",
    movement: "MOV"
  };
  const parts = stats
    .map(stat => [labels[stat] || stat.toUpperCase(), (nextStats[stat] || 0) - (currentStats[stat] || 0)])
    .filter(([, delta]) => delta !== 0)
    .map(([label, delta]) => `${label} ${signed(delta)}`);
  return parts.length ? parts.join("  ") : "No stat change";
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function inventoryIds(source) {
  if (Array.isArray(source)) return source;
  return Object.entries(source || {})
    .filter(([, qty]) => Number(qty) > 0)
    .map(([id]) => id);
}

function weaponTag(unit) {
  return weaponOf(unit).tags?.[0] || "weapon";
}

function weaponRank(unit) {
  const xp = weaponProficiency[unit.id]?.[weaponTag(unit)] || 0;
  if (xp >= 90) return "A";
  if (xp >= 55) return "B";
  if (xp >= 25) return "C";
  return "D";
}

function weaponRankBonus(unit) {
  const bonuses = data.progression.weaponRankBonuses || {};
  return bonuses[weaponRank(unit)] || {};
}

function gainWeaponProficiency(unit, amount = 5) {
  if (unit.team !== "ally") return;
  const tag = weaponTag(unit);
  const beforeRank = weaponRank(unit);
  weaponProficiency[unit.id] = weaponProficiency[unit.id] || {};
  weaponProficiency[unit.id][tag] = (weaponProficiency[unit.id][tag] || 0) + amount;
  log(`${unit.name}'s ${tag} rank progress +${amount}.`);
  const afterRank = weaponRank(unit);
  if (afterRank !== beforeRank) {
    recalcUnitStats(unit);
    log(`${unit.name}'s ${tag} rank rose to ${afterRank}.`);
  }
}

function classWeaponTags(className) {
  return {
    Guard: ["sword", "spear"],
    Scout: ["bow", "spear"],
    Mage: ["staff"]
  }[className] || [];
}

function createUnit(source) {
  const baseStats = { ...source.stats };
  const unit = { ...source, baseStats };
  const stats = buildStats(unit);
  return {
    ...unit,
    stats,
    hp: stats.maxHp,
    mp: stats.maxMp,
    initiative: 0,
    acted: false,
    moved: false,
    dead: false
  };
}

function recalcUnitStats(unit) {
  const oldMaxHp = unit.stats.maxHp;
  const oldMaxMp = unit.stats.maxMp;
  unit.stats = buildStats(unit);
  unit.hp = Math.min(unit.stats.maxHp, unit.hp + Math.max(0, unit.stats.maxHp - oldMaxHp));
  unit.mp = Math.min(unit.stats.maxMp, unit.mp + Math.max(0, unit.stats.maxMp - oldMaxMp));
}

function buildStats(unit) {
  return applyWeaponRankBonus(unit, applyEquipment(unit, applySkillTreeBonuses(unit, { ...unit.baseStats })));
}

function applySkillTreeBonuses(unit, stats) {
  const tree = data.skilltrees[unit.class];
  if (!tree) return stats;
  for (const nodeId of unit.unlockedTree || []) {
    const node = tree.nodes[nodeId];
    if (!node?.grants) continue;
    for (const [stat, gain] of Object.entries(node.grants)) stats[stat] = (stats[stat] || 0) + gain;
  }
  return stats;
}

function applyEquipment(source, stats) {
  const weapon = data.weapons[source.weapon];
  if (weapon) {
    stats.attack = (stats.attack || 0) + (weapon.attackBonus || 0);
    stats.magic = (stats.magic || 0) + (weapon.magic || 0);
    stats.accuracy = (stats.accuracy || 0) + (weapon.accuracyBonus || 0);
  }
  for (const id of Object.values(source.equipment || {})) {
    const item = findEquipment(id);
    if (!item) continue;
    for (const [stat, bonus] of Object.entries(item.bonuses || {})) stats[stat] = (stats[stat] || 0) + bonus;
  }
  return stats;
}

function applyWeaponRankBonus(unit, stats) {
  for (const [stat, bonus] of Object.entries(weaponRankBonus(unit))) {
    stats[stat] = (stats[stat] || 0) + bonus;
  }
  return stats;
}

function findEquipment(id) {
  return data.equipment.armor[id] || data.equipment.accessories[id] || null;
}

function terrainAt(x, y) {
  if (!inBounds(x, y)) return data.terrain.wall;
  const code = data.map.tiles[y][x];
  return data.terrain[data.map.legend[code]];
}

function obstacleAt(x, y) {
  return data.map.obstacles.find(o => o.x === x && o.y === y);
}

function unitAt(x, y) {
  return units.find(u => !u.dead && u.x === x && u.y === y);
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < data.map.width && y < data.map.height;
}

function passable(x, y, ignoreUnit = null) {
  const t = terrainAt(x, y);
  const o = obstacleAt(x, y);
  const u = unitAt(x, y);
  return inBounds(x, y) && t.passable && !(o && o.blocksMove) && (!u || u === ignoreUnit);
}

function moveRange(unit) {
  const frontier = [{ x: unit.x, y: unit.y, cost: 0, path: [] }];
  const seen = new Map([[key(unit.x, unit.y), { cost: 0, path: [] }]]);
  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift();
    for (const d of DIRS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (!passable(nx, ny, unit)) continue;
      const nc = cur.cost + terrainAt(nx, ny).moveCost;
      if (nc > unit.stats.movement) continue;
      const k = key(nx, ny);
      if (!seen.has(k) || nc < seen.get(k).cost) {
        const item = { cost: nc, path: [...cur.path, { x: nx, y: ny }] };
        seen.set(k, item);
        frontier.push({ x: nx, y: ny, cost: nc, path: item.path });
      }
    }
  }
  return seen;
}

function key(x, y) {
  return `${x},${y}`;
}

function parseKey(k) {
  return k.split(",").map(Number);
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function weaponOf(unit) {
  return data.weapons[unit.weapon];
}

function actionRange(action, unit) {
  if (action.kind === "attack") return weaponOf(unit).range;
  if (action.kind === "item") return data.items[action.id].range;
  return data.skills[action.id].range;
}

function actionArea(action) {
  if (action.kind === "attack" || action.kind === "item") return 0;
  return data.skills[action.id].area || 0;
}

function actionDefinition(action, unit) {
  if (action.kind === "attack") return weaponOf(unit);
  if (action.kind === "item") return data.items[action.id];
  return data.skills[action.id];
}

function cellsInRange(unit, action) {
  const [min, max] = actionRange(action, unit);
  const cells = new Set();
  for (let y = 0; y < data.map.height; y++) {
    for (let x = 0; x < data.map.width; x++) {
      const dist = distance(unit, { x, y });
      if (dist >= min && dist <= max && hasLine(unit.x, unit.y, x, y, action, unit)) cells.add(key(x, y));
    }
  }
  return cells;
}

function hasLine(x0, y0, x1, y1, action, unit) {
  const needsLine = action.kind === "attack" ? weaponOf(unit).lineOfSight : false;
  if (!needsLine) return true;
  const cells = bresenham(x0, y0, x1, y1).slice(1, -1);
  return cells.every(c => {
    const t = terrainAt(c.x, c.y);
    const o = obstacleAt(c.x, c.y);
    return !t.blocksLine && !(o && o.blocksLine);
  });
}

function bresenham(x0, y0, x1, y1) {
  const cells = [];
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    cells.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return cells;
}

function preview(attacker, target, action) {
  if (!target || target.dead) return null;
  const terrain = terrainAt(target.x, target.y);
  if (action.kind === "item") {
    const item = data.items[action.id];
    return { heal: item.power, hit: 100, crit: 0, min: item.power, max: item.power };
  }
  if (action.kind === "skill" || action.kind === "magic") {
    const skill = data.skills[action.id];
    if (skill.type === "heal") return { heal: skill.power + attacker.stats.magic, hit: 100, crit: 0, min: skill.power, max: skill.power + attacker.stats.magic };
    const atk = skill.type === "magic" ? attacker.stats.magic : attacker.stats.attack;
    const def = skill.type === "magic" ? target.stats.magicDefense : target.stats.defense;
    return finishPreview(attacker, target, skill.power + atk - def - terrain.defense, skill.accuracy, terrain);
  }
  const weapon = weaponOf(attacker);
  return finishPreview(attacker, target, attacker.stats.attack + weapon.attack - target.stats.defense - terrain.defense, weapon.accuracy, terrain);
}

function healPreview(caster, target, action) {
  const def = actionDefinition(action, caster);
  const magicBonus = action.kind === "item" ? 0 : caster.stats.magic;
  return Math.max(1, def.power + magicBonus);
}

function finishPreview(attacker, target, base, acc, terrain) {
  const facing = facingBonus(attacker, target);
  const raw = Math.max(1, Math.floor(base * FLANK[facing]));
  const min = Math.max(1, raw - 3);
  const max = raw + 3;
  const hit = clamp(acc + attacker.stats.accuracy - target.stats.evasion - terrain.evasion, 20, 98);
  const crit = facing === "back" ? 12 : facing === "side" ? 7 : 4;
  return { min, max, hit, crit, facing };
}

function facingBonus(attacker, target) {
  const dx = Math.sign(attacker.x - target.x);
  const dy = Math.sign(attacker.y - target.y);
  const attackDir = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? "right" : "left")
    : (dy > 0 ? "down" : "up");
  const opposite = { right: "left", left: "right", up: "down", down: "up" };
  if (target.facing === attackDir) return "back";
  if (opposite[target.facing] === attackDir) return "front";
  return "side";
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

async function useAction(attacker, target, action) {
  if (action.kind === "item") {
    if (inventory[action.id] <= 0) return false;
    inventory[action.id] -= 1;
    const amount = healPreview(attacker, target, action);
    target.hp = Math.min(target.stats.maxHp, target.hp + amount);
    addFloatText(target, `+${amount}`, "#7ef0b4");
    log(`${attacker.name} uses Potion on ${target.name} (+${amount} HP).`);
    endAction();
    return true;
  }
  const skill = action.id ? data.skills[action.id] : null;
  if (skill && attacker.mp < skill.mpCost) {
    log("Not enough MP.");
    return false;
  }
  if (skill) attacker.mp -= skill.mpCost;
  faceToward(attacker, target);
  if (skill) await playCutin(attacker, skill);
  if (skill && skill.type === "heal") {
    const amount = healPreview(attacker, target, action);
    target.hp = Math.min(target.stats.maxHp, target.hp + amount);
    addFloatText(target, `+${amount}`, "#7ef0b4");
    log(`${attacker.name} casts ${skill.name} on ${target.name} (+${amount} HP).`);
    endAction();
    return true;
  }
  if (action.kind === "attack" || skill?.type === "physical") gainWeaponProficiency(attacker);
  const targets = targetsInArea(target.x, target.y, actionArea(action), attacker, action);
  for (const t of targets) resolveHit(attacker, t, action);
  endAction();
  return true;
}

function playCutin(unit, skill) {
  const unitCutin = cutinAssets[unit.cutin || unit.sprite] || {};
  const def = { ...data.cutins.defaults, ...unitCutin };
  const duration = def.durationMs || data.cutins.defaults.durationMs;
  cutin = {
    unit,
    skill,
    def,
    startedAt: performance.now(),
    duration
  };
  mode = "cutin";
  renderUi();
  return new Promise(resolve => {
    setTimeout(() => {
      cutin = null;
      resolve();
    }, duration);
  });
}

function targetsInArea(x, y, area, attackerOrTeam, action = null) {
  const attackerTeam = typeof attackerOrTeam === "string" ? attackerOrTeam : attackerOrTeam.team;
  const def = action ? actionDefinition(action, typeof attackerOrTeam === "string" ? current : attackerOrTeam) : {};
  return units.filter(u => {
    if (u.dead || distance(u, { x, y }) > area) return false;
    if (def.type === "heal" || action?.kind === "item") return u.team === attackerTeam;
    if (def.friendlyFire) return true;
    return u.team !== attackerTeam;
  });
}

function resolveHit(attacker, target, action) {
  const p = preview(attacker, target, action);
  const label = action.kind === "attack" ? weaponOf(attacker).name : data.skills[action.id].name;
  if (Math.random() * 100 > p.hit) {
    log(`${attacker.name}'s ${label} misses ${target.name}.`);
    addFloatText(target, "MISS", "#d8d1c3");
    return;
  }
  let dmg = rand(p.min, p.max);
  const critical = Math.random() * 100 < p.crit;
  if (critical) dmg = Math.floor(dmg * 1.5);
  target.hp = Math.max(0, target.hp - dmg);
  addFloatText(target, critical ? `${dmg}!` : `${dmg}`, critical ? "#ffe15c" : "#ff786b");
  log(`${attacker.name} hits ${target.name} with ${label} for ${dmg}.`);
  if (target.hp <= 0) {
    target.dead = true;
    log(`${target.name} is defeated.`);
    if (attacker.team === "ally") gainExp(attacker, 35);
  }
}

function addFloatText(unit, text, color) {
  floatTexts.push({
    text,
    color,
    x: unit.x,
    y: unit.y,
    startedAt: performance.now(),
    duration: 900
  });
}

function rand(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function gainExp(unit, amount) {
  unit.exp += amount;
  while (unit.exp >= expToNext(unit)) {
    unit.exp -= expToNext(unit);
    unit.level += 1;
    if (unit.growth) {
      for (const [stat, gain] of Object.entries(unit.growth)) unit.baseStats[stat] = (unit.baseStats[stat] || 0) + gain;
      recalcUnitStats(unit);
      unit.hp = unit.stats.maxHp;
      unit.mp = unit.stats.maxMp;
    }
    unit.skillPoints = (unit.skillPoints || 0) + 1;
    log(`${unit.name} reached level ${unit.level}.`);
  }
}

function expToNext(unit) {
  return data.progression.expTable[String(unit.level)] || 300;
}

function availableSkillNodes(unit) {
  const tree = data.skilltrees[unit.class];
  if (!tree) return [];
  const unlocked = new Set(unit.unlockedTree || []);
  return Object.entries(tree.nodes)
    .filter(([id, node]) => !unlocked.has(id) && (node.requires || []).every(req => unlocked.has(req)) && (unit.skillPoints || 0) >= node.cost)
    .map(([id, node]) => ({ id, node }));
}

function unlockSkillNode(unit, nodeId) {
  const tree = data.skilltrees[unit.class];
  const node = tree?.nodes[nodeId];
  if (!node || (unit.skillPoints || 0) < node.cost) return false;
  if (!(node.requires || []).every(req => (unit.unlockedTree || []).includes(req))) return false;
  unit.skillPoints -= node.cost;
  unit.unlockedTree = [...new Set([...(unit.unlockedTree || []), nodeId])];
  if (node.grantsSkill && !unit.skills.includes(node.grantsSkill)) unit.skills.push(node.grantsSkill);
  recalcUnitStats(unit);
  log(`${unit.name} learned ${node.name}.`);
  renderUi();
  return true;
}

function faceToward(unit, target) {
  const dx = target.x - unit.x;
  const dy = target.y - unit.y;
  unit.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
}

function nextUnit() {
  checkEnd();
  if (battleOver) return;
  mode = "initiative";
  activeAction = null;
  reachable.clear();
  targetTiles.clear();
  while (true) {
    for (const u of alive()) u.initiative += u.stats.speed;
    current = alive().sort((a, b) => b.initiative - a.initiative)[0];
    if (current.initiative >= 100) break;
  }
  current.initiative -= 100;
  current.moved = false;
  current.acted = false;
  log(`${current.name}'s action.`);
  if (current.team === "enemy") {
    mode = "enemy";
    renderUi();
    setTimeout(enemyTurn, 450);
  } else {
    mode = "command";
    renderUi();
  }
}

function alive() {
  return units.filter(u => !u.dead);
}

function checkEnd() {
  if (battleOver) {
    renderUi();
    return;
  }
  const allies = units.some(u => !u.dead && u.team === "ally");
  const enemies = units.some(u => !u.dead && u.team === "enemy");
  if (!enemies) {
    finishBattle("victory", "Victory: all enemies defeated.");
  } else if (!allies) {
    finishBattle("defeat", "Defeat: all allies defeated.");
  }
  renderUi();
}

function finishBattle(outcome, message) {
  battleOver = true;
  pendingResultMode = outcome;
  const chapter = activeChapter();
  if (outcome === "victory") completeActiveChapter();
  if (battleStats) {
    battleStats.outcome = outcome;
    battleStats.endedAt = Date.now();
  }
  log(message);
  const sceneId = outcome === "victory" && chapter?.endingScene ? chapter.endingScene : data.scenario.scenes[outcome] ? outcome : null;
  if (sceneId) {
    startScenario(sceneId, "result");
  } else {
    mode = outcome;
  }
}

function endAction() {
  activeAction = null;
  reachable.clear();
  targetTiles.clear();
  if (battleStats && battleStats.startedAt && !battleOver) battleStats.actions += 1;
  applyEndOfActionTerrain(current);
  checkEnd();
  if (!battleOver) setTimeout(nextUnit, 450);
}

function applyEndOfActionTerrain(unit) {
  if (!unit || unit.dead) return;
  const terrain = terrainAt(unit.x, unit.y);
  if (!terrain.hazardDamage) return;
  unit.hp = Math.max(0, unit.hp - terrain.hazardDamage);
  addFloatText(unit, `${terrain.hazardDamage}`, "#c994ff");
  log(`${unit.name} takes ${terrain.hazardDamage} terrain damage from ${terrain.name}.`);
  if (unit.hp <= 0) {
    unit.dead = true;
    log(`${unit.name} is defeated by terrain.`);
  }
}

function wait() {
  log(`${current.name} waits.`);
  current.initiative += 15;
  endAction();
}

function saveGame() {
  if (!data || !units.length) return;
  confirmDialog = null;
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    currentId: current?.id || null,
    mode,
    battleOver,
    inventory,
    weaponInventory,
    equipmentInventory,
    gold,
    storyFlags,
    townId,
    townCursor,
    shopId,
    shopCursor,
    dungeonCursor,
    selectedDungeonId,
    chapterCursor,
    activeChapterId,
    maxUnlockedChapter,
    completedChapters,
    weaponProficiency,
    messages,
    battleStats,
    partyIndex,
    returnMode,
    units: units.map(u => ({
      id: u.id,
      team: u.team,
      sprite: u.sprite,
      aiRole: u.aiRole || null,
      x: u.x,
      y: u.y,
      facing: u.facing,
      level: u.level,
      exp: u.exp,
      hp: u.hp,
      mp: u.mp,
      initiative: u.initiative,
      dead: u.dead,
      moved: u.moved,
      acted: u.acted,
      baseStats: u.baseStats,
      stats: u.stats,
      weapon: u.weapon,
      equipment: u.equipment || {},
      skillPoints: u.skillPoints || 0,
      unlockedTree: u.unlockedTree || [],
      skills: u.skills || []
    }))
  };
  localStorage.setItem(saveKey(), JSON.stringify(payload));
  log(`Saved battle state to slot ${saveSlot}.`);
}

function loadGame() {
  const raw = localStorage.getItem(saveKey());
  if (!raw) {
    log(`No save data found in slot ${saveSlot}.`);
    return;
  }
  try {
    const payload = JSON.parse(raw);
    if (payload.version !== 1 || !Array.isArray(payload.units)) throw new Error("Unsupported save data.");
    units = payload.units.map(saved => {
      const base = [...data.characters.allies, ...data.characters.enemies].find(u => u.id === saved.id) || saved;
      return { ...base, ...saved };
    });
    inventory = { ...(payload.inventory || {}) };
    weaponInventory = { ...(payload.weaponInventory || data.progression.weaponInventory || {}) };
    equipmentInventory = structuredClone(payload.equipmentInventory || data.progression.equipmentInventory || {});
    gold = typeof payload.gold === "number" ? payload.gold : data.progression.gold || 0;
    storyFlags = { ...(payload.storyFlags || {}) };
    townId = payload.townId || data.locations.startTown || "stoneford";
    townCursor = payload.townCursor || 0;
    shopId = payload.shopId || null;
    shopCursor = payload.shopCursor || 0;
    dungeonCursor = payload.dungeonCursor || 0;
    selectedDungeonId = payload.selectedDungeonId || null;
    chapterCursor = payload.chapterCursor || 0;
    activeChapterId = payload.activeChapterId || null;
    maxUnlockedChapter = payload.maxUnlockedChapter || 1;
    completedChapters = { ...(payload.completedChapters || {}) };
    weaponProficiency = payload.weaponProficiency || Object.fromEntries(data.characters.allies.map(unit => [unit.id, {}]));
    messages = Array.isArray(payload.messages) ? payload.messages.slice(-12) : [];
    battleStats = payload.battleStats || { startedAt: null, endedAt: null, actions: 0, outcome: null };
    battleOver = Boolean(payload.battleOver);
    partyIndex = payload.partyIndex || 0;
    returnMode = payload.returnMode || "briefing";
    current = units.find(u => u.id === payload.currentId) || null;
    mode = ["town", "shop", "dungeon", "chapter", "party", "briefing"].includes(payload.mode) ? payload.mode : battleOver ? payload.mode : current?.team === "ally" ? "command" : "enemy";
    if (["town", "shop", "dungeon", "chapter"].includes(mode)) {
      units = partyMembers();
      current = null;
    }
    activeAction = null;
    reachable.clear();
    targetTiles.clear();
    confirmDialog = null;
    log(`Loaded battle state from slot ${saveSlot}.`);
    if (current?.team === "enemy" && !battleOver) setTimeout(enemyTurn, 450);
    renderUi();
  } catch (err) {
    log(`Load failed: ${err.message}`);
  }
}

function saveKey() {
  return `${SAVE_PREFIX}${saveSlot}`;
}

function cycleSaveSlot() {
  saveSlot = saveSlot % SAVE_SLOT_COUNT + 1;
  log(`Selected save slot ${saveSlot}.`);
  renderUi();
}

function restartBattle() {
  startNewBattle();
}

function enemyTurn() {
  if (battleOver || !current || current.dead) return nextUnit();
  const plan = chooseEnemyPlan(current);
  if (!plan) {
    wait();
    return;
  }
  if (plan.move && (plan.move.x !== current.x || plan.move.y !== current.y)) {
    faceMove(current, plan.move.x, plan.move.y);
    current.x = plan.move.x;
    current.y = plan.move.y;
    log(`${current.name} moves to ${terrainAt(current.x, current.y).name}.`);
  }
  if (plan.action && plan.target) {
    setTimeout(() => useAction(current, plan.target, plan.action), plan.move ? 300 : 0);
  } else {
    setTimeout(wait, plan.move ? 300 : 0);
  }
}

function chooseEnemyPlan(enemy) {
  const range = moveRange(enemy);
  let best = null;
  for (const [k, node] of range.entries()) {
    const [x, y] = parseKey(k);
    const original = { x: enemy.x, y: enemy.y };
    enemy.x = x;
    enemy.y = y;
    const options = enemyOptions(enemy);
    enemy.x = original.x;
    enemy.y = original.y;
    const terrainScore = terrainValueForEnemy(enemy, x, y);
    const movePenalty = node.cost * 0.08;
    if (options.length) {
      const option = options[0];
      const score = option.score + terrainScore - movePenalty;
      if (!best || score > best.score) best = { ...option, move: { x, y }, score };
    } else {
      const approachScore = approachScore(enemy, x, y) + terrainScore - movePenalty;
      if (!best || approachScore > best.score) best = { move: { x, y }, action: null, target: null, score: approachScore };
    }
  }
  return best;
}

function enemyOptions(enemy) {
  const actions = [{ kind: "attack" }, ...enemy.skills.map(id => ({ kind: data.skills[id].type === "magic" ? "magic" : "skill", id }))];
  const result = [];
  for (const action of actions) {
    if (action.id && enemy.mp < data.skills[action.id].mpCost) continue;
    const range = cellsInRange(enemy, action);
    const def = actionDefinition(action, enemy);
    if (def.type === "heal") {
      for (const ally of units.filter(u => !u.dead && u.team === enemy.team && u.hp < u.stats.maxHp)) {
        if (!range.has(key(ally.x, ally.y))) continue;
        const missing = ally.stats.maxHp - ally.hp;
        const amount = Math.min(missing, healPreview(enemy, ally, action));
        const urgency = ally.hp / ally.stats.maxHp < 0.45 ? 28 : 8;
        const selfBonus = ally === enemy ? 8 : 0;
        result.push({ target: ally, action, score: amount + urgency + selfBonus });
      }
      continue;
    }
    if (actionArea(action) > 0) {
      for (const k of range) {
        const [x, y] = parseKey(k);
        const affected = targetsInArea(x, y, actionArea(action), enemy, action);
        if (!affected.length) continue;
        const damageScore = affected.reduce((sum, target) => sum + enemyTargetScore(enemy, target, action), 0);
        result.push({ target: { x, y }, action, score: damageScore + affected.length * 8 });
      }
      continue;
    }
    for (const ally of units.filter(u => !u.dead && u.team === "ally")) {
      if (!range.has(key(ally.x, ally.y))) continue;
      result.push({ target: ally, action, score: enemyTargetScore(enemy, ally, action) });
    }
  }
  return result.sort((a, b) => b.score - a.score);
}

function enemyTargetScore(enemy, target, action) {
  const p = preview(enemy, target, action);
  const expected = ((p.min + p.max) / 2) * (p.hit / 100) + p.crit * 0.12;
  const killBonus = p.max >= target.hp ? 35 : 0;
  const vulnerableBonus = target.hp / target.stats.maxHp < 0.45 ? 14 : 0;
  const threat = target.stats.attack + target.stats.magic + target.stats.speed * 0.5;
  const bossBonus = enemy.aiRole === "boss" ? (killBonus * 0.5 + vulnerableBonus + threat * 0.15) : 0;
  return expected + killBonus + vulnerableBonus + threat * 0.25 + bossBonus;
}

function approachScore(enemy, x, y) {
  const role = enemy.aiRole || "melee";
  const nearest = units
    .filter(u => !u.dead && u.team === "ally")
    .map(u => distance({ x, y }, u))
    .sort((a, b) => a - b)[0] ?? 99;
  if (role === "healer") {
    const woundedAlly = units
      .filter(u => !u.dead && u.team === enemy.team && u.hp < u.stats.maxHp)
      .map(u => distance({ x, y }, u))
      .sort((a, b) => a - b)[0];
    if (woundedAlly !== undefined) return -woundedAlly * 2;
    return -Math.abs(nearest - 4) * 2;
  }
  if (role === "ranged" || role === "caster") {
    const ideal = role === "caster" ? 3 : 4;
    return -Math.abs(nearest - ideal) * 2 - (nearest <= 1 ? 8 : 0);
  }
  if (role === "boss") return -nearest * 1.5 + terrainAt(x, y).defense * 2;
  return -nearest * 2;
}

function terrainValueForEnemy(enemy, x, y) {
  const terrain = terrainAt(x, y);
  const hazard = terrain.hazardDamage ? -terrain.hazardDamage * 1.8 : 0;
  const roleWeight = enemy.aiRole === "ranged" || enemy.aiRole === "caster" ? 0.08 : 0.04;
  return terrain.defense * 1.5 + terrain.evasion * roleWeight + hazard;
}

function setMode(nextMode, action = null) {
  if (!current || current.team !== "ally" || battleOver) return;
  mode = nextMode;
  activeAction = action;
  reachable.clear();
  targetTiles.clear();
  if (mode === "move") reachable = moveRange(current);
  if (mode === "target") targetTiles = cellsInRange(current, activeAction);
  renderUi();
}

function screenToTile(ev) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor(((ev.clientX - rect.left) * scaleX - MAP_X) / TILE);
  const y = Math.floor(((ev.clientY - rect.top) * scaleY - MAP_Y) / TILE);
  return { x, y };
}

canvas.addEventListener("mousemove", ev => {
  hoverTile = screenToTile(ev);
  renderUi();
});

canvas.addEventListener("click", ev => {
  if (mode === "party") return;
  if (mode === "scenario") {
    advanceScenario();
    return;
  }
  if (!current || current.team !== "ally" || battleOver) return;
  const tile = screenToTile(ev);
  if (!inBounds(tile.x, tile.y)) return;
  if (mode === "move") {
    if (!reachable.has(key(tile.x, tile.y))) return;
    faceMove(current, tile.x, tile.y);
    current.x = tile.x;
    current.y = tile.y;
    current.moved = true;
    mode = "command";
    reachable.clear();
    renderUi();
    return;
  }
  if (mode === "target" && targetTiles.has(key(tile.x, tile.y))) {
    const target = unitAt(tile.x, tile.y);
    const canTargetGround = actionArea(activeAction) > 0 && activeAction.kind !== "item";
    const valid = target ? validTarget(current, target, activeAction) : canTargetGround;
    if (valid) useAction(current, target || tile, activeAction);
  }
});

window.addEventListener("keydown", ev => {
  if (mode === "town") {
    if (ev.key === "Tab" || ev.key === "ArrowDown" || ev.key === "ArrowRight") {
      ev.preventDefault();
      cycleTownNpc();
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      talkTownNpc();
    }
    return;
  }
  if (mode === "shop") {
    if (ev.key === "Tab" || ev.key === "ArrowDown" || ev.key === "ArrowRight") {
      ev.preventDefault();
      nextShopItem();
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      buyShopItem();
    }
    if (ev.key === "Escape") enterTown();
    return;
  }
  if (mode === "dungeon") {
    if (ev.key === "Tab" || ev.key === "ArrowDown" || ev.key === "ArrowRight") {
      ev.preventDefault();
      nextDungeon();
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      startSelectedDungeon();
    }
    if (ev.key === "Escape") enterTown();
    return;
  }
  if (mode === "chapter") {
    if (ev.key === "Tab" || ev.key === "ArrowDown" || ev.key === "ArrowRight") {
      ev.preventDefault();
      nextChapter();
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      startSelectedChapter();
    }
    if (ev.key === "Escape") enterTown();
    return;
  }
  if (mode === "party" && confirmDialog) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      confirmSkillUnlock();
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      cancelConfirmDialog();
    }
    return;
  }
  if (ev.key === "Tab" && mode === "party") {
    ev.preventDefault();
    nextPartyMember();
  }
  if ((ev.key === "ArrowDown" || ev.key === "ArrowRight") && mode === "party") {
    ev.preventDefault();
    nextSkillNode();
  }
  if (ev.key === "Enter" && mode === "party") {
    ev.preventDefault();
    trainSelectedSkillNode();
  }
  if (ev.key === "Escape" && mode === "party") closeParty();
  if ((ev.key === "Enter" || ev.key === " ") && mode === "scenario") {
    ev.preventDefault();
    advanceScenario();
  }
  if (ev.key === "Enter" && mode === "briefing") beginBattle();
  if (ev.key === "Escape" && ["move", "target"].includes(mode)) {
    mode = "command";
    activeAction = null;
    reachable.clear();
    targetTiles.clear();
    renderUi();
  }
});

function validTarget(actor, target, action) {
  if (!target) return actionArea(action) > 0 && action.kind !== "item";
  if (action.kind === "item") return target.team === actor.team && target.hp < target.stats.maxHp;
  const skill = action.id ? data.skills[action.id] : null;
  if (skill && skill.type === "heal") return target.team === actor.team && target.hp < target.stats.maxHp;
  return target.team !== actor.team;
}

function faceMove(unit, x, y) {
  const dx = x - unit.x;
  const dy = y - unit.y;
  if (dx || dy) unit.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
}

function renderUi() {
  if (!data) return;
  ui.phase.textContent = mode === "scenario"
    ? `SCENARIO - ${scenarioState?.sceneId || ""} / SLOT ${saveSlot}`
    : mode === "town"
    ? `TOWN - ${townData().name} / SLOT ${saveSlot}`
    : mode === "shop"
    ? `SHOP - ${shopData()?.name || ""} / SLOT ${saveSlot}`
    : mode === "dungeon"
    ? `DUNGEON / SLOT ${saveSlot}`
    : mode === "chapter"
    ? `CHAPTER / SLOT ${saveSlot}`
    : mode === "party"
    ? `PARTY / SLOT ${saveSlot}`
    : mode === "briefing"
    ? `BRIEFING / SLOT ${saveSlot}`
    : battleOver ? `${mode.toUpperCase()} / SLOT ${saveSlot}` : `${mode.toUpperCase()} ${current ? "- " + current.name : ""} / SLOT ${saveSlot}`;
  ui.order.innerHTML = "";
  for (const u of mode === "briefing" ? alive().sort((a, b) => b.stats.speed - a.stats.speed).slice(0, 7) : previewOrder(7)) {
    const li = document.createElement("li");
    li.className = u.team;
    li.textContent = `${u.team === "ally" ? "ALLY" : "ENEMY"} ${u.name}`;
    ui.order.appendChild(li);
  }
  const selected = mode === "party" ? selectedPartyMember() : hoverTile && unitAt(hoverTile.x, hoverTile.y) ? unitAt(hoverTile.x, hoverTile.y) : current;
  ui.unit.textContent = mode === "scenario" ? scenarioInfoText() : mode === "town" ? townInfoText() : mode === "shop" ? shopInfoText() : mode === "dungeon" ? dungeonInfoText() : mode === "chapter" ? chapterInfoText() : selected ? `${selected.name} / ${selected.class}
Lv ${selected.level}  EXP ${selected.exp}/${expToNext(selected)}
HP ${selected.hp}/${selected.stats.maxHp}  MP ${selected.mp}/${selected.stats.maxMp}
ATK ${selected.stats.attack}  DEF ${selected.stats.defense}
MAG ${selected.stats.magic}  MDF ${selected.stats.magicDefense}
SPD ${selected.stats.speed}  MOV ${selected.stats.movement}
Weapon: ${weaponOf(selected).name}
Armor: ${equipmentName(selected.equipment?.armor)}
Accessory: ${equipmentName(selected.equipment?.accessory)}
Sprite: ${selected.sprite || "-"}
AI Role: ${selected.aiRole || "-"}
SP: ${selected.skillPoints || 0}
Tree: ${(selected.unlockedTree || []).join(", ") || "-"}
Facing: ${selected.facing}` : briefingText();
  const ht = hoverTile && inBounds(hoverTile.x, hoverTile.y) && !["town", "shop", "dungeon", "chapter"].includes(mode) ? terrainAt(hoverTile.x, hoverTile.y) : null;
  ui.terrain.textContent = ht ? `${ht.name}
Move Cost: ${ht.moveCost}
Defense: ${ht.defense}
Evasion: ${ht.evasion}
Hazard Damage: ${ht.hazardDamage || 0}
Passable: ${ht.passable ? "Yes" : "No"}` : "";
  renderCommands();
  renderPrediction();
  ui.log.textContent = messages.slice(-7).join("\n");
}

function previewOrder(count) {
  const ghosts = alive().map(u => ({ ...u }));
  const result = [];
  while (result.length < count && ghosts.length) {
    for (const g of ghosts) g.initiative += g.stats.speed;
    const next = ghosts.sort((a, b) => b.initiative - a.initiative)[0];
    next.initiative -= 100;
    result.push(next);
  }
  return result;
}

function renderCommands() {
  ui.commands.innerHTML = "";
  if (mode === "party") {
    if (confirmDialog) {
      addButton("CONFIRM", confirmSkillUnlock);
      addButton("CANCEL", cancelConfirmDialog);
      return;
    }
    addButton("NEXT UNIT", nextPartyMember);
    addButton("EQUIP WEAPON", equipNextWeapon);
    addButton("EQUIP ARMOR", () => equipNext("armor"));
    addButton("EQUIP ACC", () => equipNext("accessory"));
    addButton("NEXT SKILL", nextSkillNode);
    addButton("TRAIN SELECT", trainSelectedSkillNode);
    addButton("BACK", closeParty);
    addButton(`SLOT ${saveSlot}`, cycleSaveSlot);
    addButton("SAVE", saveGame, !units.length);
    return;
  }
  if (mode === "town") {
    addButton("TALK", talkTownNpc);
    addButton("NEXT NPC", cycleTownNpc);
    addButton("SHOP", () => enterShop());
    addButton("INN", useInn);
    addButton("PARTY", openParty);
    addButton("CHAPTER", enterChapterSelect);
    addButton("DUNGEON", enterDungeon);
    addButton(`SLOT ${saveSlot}`, cycleSaveSlot);
    addButton("SAVE", saveGame, !units.length);
    addButton("LOAD", loadGame);
    addButton("RESTART", restartBattle, !data);
    return;
  }
  if (mode === "shop") {
    addButton("BUY", buyShopItem);
    addButton("NEXT ITEM", nextShopItem);
    addButton("BACK", () => enterTown());
    addButton(`SLOT ${saveSlot}`, cycleSaveSlot);
    addButton("SAVE", saveGame, !units.length);
    addButton("LOAD", loadGame);
    return;
  }
  if (mode === "dungeon") {
    addButton("START", startSelectedDungeon);
    addButton("NEXT ROUTE", nextDungeon);
    addButton("BACK", () => enterTown());
    addButton(`SLOT ${saveSlot}`, cycleSaveSlot);
    addButton("SAVE", saveGame, !units.length);
    addButton("LOAD", loadGame);
    return;
  }
  if (mode === "chapter") {
    addButton("START", startSelectedChapter);
    addButton("NEXT CHAPTER", nextChapter);
    addButton("BACK", () => enterTown());
    addButton(`SLOT ${saveSlot}`, cycleSaveSlot);
    addButton("SAVE", saveGame, !units.length);
    addButton("LOAD", loadGame);
    return;
  }
  if (mode === "scenario") {
    addButton("NEXT", advanceScenario);
    addButton("SKIP", skipScenario);
    addButton(`SLOT ${saveSlot}`, cycleSaveSlot);
    addButton("LOAD", loadGame);
    addButton("RESTART", restartBattle, !data);
    return;
  }
  if (mode === "briefing") {
    addButton("START", beginBattle);
    addButton("PARTY", openParty);
    addButton(`SLOT ${saveSlot}`, cycleSaveSlot);
    addButton("LOAD", loadGame);
    addButton("RESTART", restartBattle, !data);
    return;
  }
  if (mode === "cutin") {
    addButton("CUT-IN", () => {}, true);
    return;
  }
  if (battleOver) {
    addButton("TOWN", () => enterTown());
    addButton("PARTY", openParty);
    addButton(`SLOT ${saveSlot}`, cycleSaveSlot);
    addButton("SAVE RESULT", saveGame, !units.length);
    addButton("LOAD", loadGame);
    addButton("RESTART", restartBattle, !data);
    return;
  }
  if (!current || current.team !== "ally" || mode === "enemy") {
    addButton("SAVE", saveGame, !units.length);
    addButton("LOAD", loadGame);
    addButton("RESTART", restartBattle, !data);
    return;
  }
  addButton("MOVE", () => setMode("move"), current.moved);
  addButton("ATTACK", () => setMode("target", { kind: "attack" }));
  for (const id of current.skills.filter(skillId => data.skills[skillId].type === "physical")) {
    addButton(`SKILL ${data.skills[id].name}`, () => setMode("target", { kind: "skill", id }), current.mp < data.skills[id].mpCost);
  }
  for (const id of current.skills.filter(skillId => ["magic", "heal"].includes(data.skills[skillId].type))) {
    addButton(`MAGIC ${data.skills[id].name}`, () => setMode("target", { kind: "magic", id }), current.mp < data.skills[id].mpCost);
  }
  for (const { id, node } of availableSkillNodes(current)) {
    addButton(`TRAIN ${node.name}`, () => unlockSkillNode(current, id));
  }
  addButton(`ITEM Potion x${inventory.potion || 0}`, () => setMode("target", { kind: "item", id: "potion" }), !inventory.potion);
  addButton("WAIT", wait);
  if (["move", "target"].includes(mode)) addButton("CANCEL", () => setMode("command"));
  addButton(`SLOT ${saveSlot}`, cycleSaveSlot);
  addButton("SAVE", saveGame);
  addButton("LOAD", loadGame);
  addButton("RESTART", restartBattle);
}

function skipScenario() {
  if (mode !== "scenario" || !scenarioState) return;
  scenarioState.index = scenarioState.scene.lines.length - 1;
  advanceScenario();
}

function scenarioInfoText() {
  const line = currentScenarioLine();
  if (!line) return "";
  return `${line.speaker}
Scene: ${scenarioState.sceneId}
Line: ${scenarioState.index + 1}/${scenarioState.scene.lines.length}
Portrait: ${line.portrait || "-"}

Click, Enter, or Space to advance.`;
}

function townInfoText() {
  const town = townData();
  const npc = selectedTownNpc();
  return `${town.name}
Gold: ${gold}G
Location: ${town.region}

NPC: ${npc ? npc.name : "-"}
${npc ? npc.role : ""}

Services:
Shop: ${data.shops[town.shopId]?.name || "-"}
Inn: ${town.inn?.cost || 0}G
Dungeon Routes: ${(town.dungeons || []).length}`;
}

function shopInfoText() {
  const shop = shopData();
  const stock = shop?.stock || [];
  const item = stock[shopCursor] || null;
  return `${shop?.name || "Shop"}
Gold: ${gold}G
Item: ${item ? shopItemName(item) : "-"}
Price: ${item?.price || 0}G
Type: ${item?.type || "-"}
Stock Entry: ${stock.length ? shopCursor + 1 : 0}/${stock.length}

Use BUY to purchase.
Use NEXT ITEM to browse.`;
}

function dungeonInfoText() {
  const routes = townData().dungeons || [];
  const dungeon = routes[dungeonCursor] || null;
  return `Dungeon Select
Gold: ${gold}G
Route: ${dungeon?.name || "-"}
Threat: ${dungeon?.threat || "-"}
Map Size: ${dungeon?.mapSize || "-"}
Enemy Count: ${dungeon?.enemyCount || "-"}
Map: ${dungeon?.mapName || data.map.name}

Each route now uses its own map size, enemy count, and intro scene.`;
}

function chapterInfoText() {
  const chapter = selectedChapter();
  return `Chapter Select
Unlocked: ${maxUnlockedChapter}/${data.chapters.totalChapters}
Completed: ${Object.keys(completedChapters).length}

Selected:
${chapter ? `Chapter ${chapter.number}: ${chapter.title}` : "-"}
Status: ${chapter && completedChapters[chapter.id] ? "Cleared" : "Open"}
Route: ${chapter ? chapter.dungeonId : "-"}
Reward: ${chapter?.reward?.gold || 0}G`;
}

function equipmentName(id) {
  return id ? findEquipment(id)?.name || id : "-";
}

function skillNodeSummary(node) {
  const grants = Object.entries(node.grants || {}).map(([stat, value]) => `${stat} ${signed(value)}`);
  const skillId = node.grantsSkill || node.skill;
  const skill = skillId ? `Skill: ${data.skills[skillId]?.name || skillId}` : null;
  return [...grants, skill].filter(Boolean).join("  ") || "No direct bonus";
}

function addButton(label, onClick, disabled = false) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.disabled = disabled;
  btn.className = mode === label.toLowerCase() ? "active" : "";
  btn.addEventListener("click", onClick);
  ui.commands.appendChild(btn);
}

function briefingText() {
  const briefing = data.map.briefing;
  const dungeon = selectedDungeon();
  if (!briefing) return "";
  return `${dungeon?.name || briefing.title}
Threat: ${dungeon?.threat || "-"}
Map Size: ${dungeon?.mapSize || data.map.sizeLabel || "-"}
Enemy Count: ${dungeon?.enemyCount || "-"}
Objective: ${briefing.objective}
Defeat: ${briefing.defeat}

Route:
${dungeon?.description || "Standard combat route."}

Tips:
${[...(dungeon?.tips || []), ...briefing.tips].map(tip => `- ${tip}`).join("\n")}`;
}

function renderPrediction() {
  if (mode === "scenario") {
    const line = currentScenarioLine();
    ui.prediction.textContent = line ? `${line.speaker}: ${line.text}` : "Scenario";
    return;
  }
  if (mode === "town") {
    const npc = selectedTownNpc();
    ui.prediction.textContent = `${townData().description}

Selected NPC: ${npc ? `${npc.name} - ${npc.role}` : "-"}`;
    return;
  }
  if (mode === "shop") {
    const item = (shopData()?.stock || [])[shopCursor];
    ui.prediction.textContent = item ? `${shopItemName(item)}
Price: ${item.price}G
${item.description || "Adds one copy to your inventory."}` : "No shop stock.";
    return;
  }
  if (mode === "dungeon") {
    const dungeon = (townData().dungeons || [])[dungeonCursor];
    ui.prediction.textContent = dungeon ? `${dungeon.name}
${dungeon.description}

Victory returns to the result screen; use TOWN afterward to go back to the hub.` : "No dungeon route.";
    return;
  }
  if (mode === "chapter") {
    const chapter = selectedChapter();
    const dungeon = chapter ? (townData().dungeons || []).find(route => route.id === chapter.dungeonId) : null;
    ui.prediction.textContent = chapter ? `Chapter ${chapter.number}: ${chapter.title}
Target Play Time: Story ${chapter.storyMinutes} min / Battle ${chapter.battleMinutes} min
Route: ${dungeon?.name || chapter.dungeonId}
Size: ${dungeon?.mapSize || "-"} / Enemies: ${dungeon?.enemyCount || "-"}

${chapter.summary}` : "No chapter available.";
    return;
  }
  if (mode === "briefing") {
    const dungeon = selectedDungeon();
    ui.prediction.textContent = `${dungeon?.name || data.map.name}
Map Size: ${dungeon?.mapSize || data.map.sizeLabel || "-"} / Enemy Count: ${dungeon?.enemyCount || "-"}
${dungeon?.description || "Press START or Enter to begin."}

Press START or Enter to begin. Use the right panel to inspect turn order, units, terrain, and command choices.`;
    return;
  }
  if (battleOver) {
    ui.prediction.textContent = resultText();
    return;
  }
  if (mode !== "target" || !hoverTile || !targetTiles.has(key(hoverTile.x, hoverTile.y))) {
    ui.prediction.textContent = activeAction ? "Select a highlighted target tile." : "Select MOVE, ATTACK, SKILL, MAGIC, ITEM, or WAIT.";
    return;
  }
  const target = unitAt(hoverTile.x, hoverTile.y);
  if (!target || !validTarget(current, target, activeAction)) {
    if (activeAction && actionArea(activeAction) > 0) {
      const affected = targetsInArea(hoverTile.x, hoverTile.y, actionArea(activeAction), current, activeAction);
      const label = data.skills[activeAction.id].name;
      ui.prediction.textContent = `${label}
Area: ${actionArea(activeAction)}
Targets: ${affected.map(u => u.name).join(", ") || "none"}`;
      return;
    }
    ui.prediction.textContent = "No valid target on this tile.";
    return;
  }
  const p = preview(current, target, activeAction);
  const label = activeAction.kind === "attack" ? weaponOf(current).name : activeAction.kind === "item" ? data.items[activeAction.id].name : data.skills[activeAction.id].name;
  ui.prediction.textContent = p.heal
    ? `${label}
Heal: ${p.heal}
Hit: 100%`
    : `${label}
Damage: ${p.min}-${p.max}
Hit: ${p.hit}%
Critical: ${p.crit}%
Facing: ${p.facing}`;
}

function resultText() {
  const outcome = battleStats?.outcome || mode;
  const aliveAllies = units.filter(u => u.team === "ally" && !u.dead).length;
  const defeatedEnemies = units.filter(u => u.team === "enemy" && u.dead).length;
  const totalEnemies = units.filter(u => u.team === "enemy").length;
  const actions = battleStats?.actions || 0;
  return `${outcome.toUpperCase()}
Actions: ${actions}
Allies Standing: ${aliveAllies}
Enemies Defeated: ${defeatedEnemies}/${totalEnemies}
Grade: ${resultGrade()}`;
}

function resultGrade() {
  if (mode !== "victory") return "-";
  const aliveAllies = units.filter(u => u.team === "ally" && !u.dead).length;
  const actions = battleStats?.actions || 99;
  if (aliveAllies === 3 && actions <= 18) return "S";
  if (aliveAllies >= 2 && actions <= 24) return "A";
  if (aliveAllies >= 1 && actions <= 32) return "B";
  return "C";
}

function log(text) {
  messages.push(text);
  renderUi();
}

function draw() {
  if (data) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pruneFloatTexts();
    drawMap();
    drawHighlights();
    drawUnits();
    drawFloatTexts();
    drawLegend();
    drawCutin();
    drawRpgOverlay();
    drawBattleOverlay();
    drawScenarioOverlay();
    drawPartyOverlay();
    drawConfirmDialog();
  }
  requestAnimationFrame(draw);
}

function drawMap() {
  for (let y = 0; y < data.map.height; y++) {
    for (let x = 0; x < data.map.width; x++) {
      const t = terrainAt(x, y);
      ctx.fillStyle = t.color;
      ctx.fillRect(MAP_X + x * TILE, MAP_Y + y * TILE, TILE, TILE);
      ctx.strokeStyle = "rgba(20,20,20,.55)";
      ctx.strokeRect(MAP_X + x * TILE, MAP_Y + y * TILE, TILE, TILE);
    }
  }
  for (const o of data.map.obstacles) {
    const px = MAP_X + o.x * TILE;
    const py = MAP_Y + o.y * TILE;
    ctx.fillStyle = o.type === "tree" ? "#1f4d33" : o.type === "rock" ? "#4b4a47" : "#6b4b2f";
    ctx.fillRect(px + 10, py + 10, TILE - 20, TILE - 20);
    ctx.strokeStyle = "#1b1916";
    ctx.strokeRect(px + 10, py + 10, TILE - 20, TILE - 20);
  }
}

function drawHighlights() {
  drawHazards();
  if (mode === "move") {
    for (const k of reachable.keys()) {
      const [x, y] = parseKey(k);
      drawCell(x, y, "rgba(85, 170, 255, .35)");
    }
    drawMovePathPreview();
  }
  if (mode === "target") {
    for (const k of targetTiles.keys()) {
      const [x, y] = parseKey(k);
      drawCell(x, y, "rgba(238, 199, 83, .35)");
    }
  }
  drawTargetPreview();
  if (hoverTile && inBounds(hoverTile.x, hoverTile.y)) drawCell(hoverTile.x, hoverTile.y, "rgba(255,255,255,.18)");
}

function drawMovePathPreview() {
  if (!hoverTile || !reachable.has(key(hoverTile.x, hoverTile.y))) return;
  const node = reachable.get(key(hoverTile.x, hoverTile.y));
  if (!node?.path?.length) return;
  ctx.strokeStyle = "rgba(255, 255, 210, .9)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(MAP_X + current.x * TILE + TILE / 2, MAP_Y + current.y * TILE + TILE / 2);
  for (const step of node.path) {
    ctx.lineTo(MAP_X + step.x * TILE + TILE / 2, MAP_Y + step.y * TILE + TILE / 2);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  for (const [i, step] of node.path.entries()) {
    ctx.fillStyle = "rgba(20, 18, 16, .72)";
    ctx.beginPath();
    ctx.arc(MAP_X + step.x * TILE + TILE / 2, MAP_Y + step.y * TILE + TILE / 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff7e6";
    ctx.font = "700 11px Segoe UI";
    ctx.fillText(String(i + 1), MAP_X + step.x * TILE + TILE / 2 - 3, MAP_Y + step.y * TILE + TILE / 2 + 4);
  }
}

function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(MAP_X + x * TILE, MAP_Y + y * TILE, TILE, TILE);
}

function drawHazards() {
  for (let y = 0; y < data.map.height; y++) {
    for (let x = 0; x < data.map.width; x++) {
      if (!terrainAt(x, y).hazardDamage) continue;
      drawCell(x, y, "rgba(154, 68, 215, .28)");
      ctx.fillStyle = "rgba(255, 230, 255, .75)";
      ctx.font = "700 12px Segoe UI";
      ctx.fillText("DMG", MAP_X + x * TILE + 14, MAP_Y + y * TILE + 32);
    }
  }
}

function drawTargetPreview() {
  if (mode !== "target" || !activeAction || !hoverTile || !targetTiles.has(key(hoverTile.x, hoverTile.y))) return;
  const area = actionArea(activeAction);
  if (area > 0) {
    for (let y = 0; y < data.map.height; y++) {
      for (let x = 0; x < data.map.width; x++) {
        if (distance({ x, y }, hoverTile) <= area) drawCell(x, y, "rgba(245, 96, 86, .34)");
      }
    }
  }
  const line = bresenham(current.x, current.y, hoverTile.x, hoverTile.y);
  if (hasLine(current.x, current.y, hoverTile.x, hoverTile.y, activeAction, current)) {
    ctx.strokeStyle = "rgba(255, 255, 210, .85)";
  } else {
    ctx.strokeStyle = "rgba(255, 80, 70, .85)";
  }
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < line.length; i++) {
    const px = MAP_X + line[i].x * TILE + TILE / 2;
    const py = MAP_Y + line[i].y * TILE + TILE / 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawUnits() {
  for (const u of units.filter(unit => !unit.dead)) {
    const px = MAP_X + u.x * TILE;
    const py = MAP_Y + u.y * TILE;
    drawUnitSprite(u, px, py);
    ctx.fillStyle = "#101010";
    ctx.font = "10px Segoe UI";
    ctx.fillText(u.name.slice(0, 5), px + 7, py + 55);
    drawHpBar(u, px + 6, py + 4);
    drawFacing(u, px, py);
    if (u === current) {
      ctx.strokeStyle = "#fff2a8";
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
      ctx.lineWidth = 1;
    }
  }
}

function pruneFloatTexts() {
  const now = performance.now();
  floatTexts = floatTexts.filter(item => now - item.startedAt < item.duration);
}

function drawFloatTexts() {
  const now = performance.now();
  ctx.save();
  ctx.textAlign = "center";
  for (const item of floatTexts) {
    const t = clamp((now - item.startedAt) / item.duration, 0, 1);
    const px = MAP_X + item.x * TILE + TILE / 2;
    const py = MAP_Y + item.y * TILE + 8 - t * 24;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = "rgba(20, 18, 16, .78)";
    ctx.fillRect(px - 24, py - 18, 48, 22);
    ctx.fillStyle = item.color;
    ctx.font = "700 16px Segoe UI";
    ctx.fillText(item.text, px, py - 2);
  }
  ctx.restore();
}

function drawUnitSprite(unit, px, py) {
  const defaults = data.sprites.defaults;
  const sprite = spriteAssets[unit.sprite] || {};
  const def = { ...defaults, ...sprite };
  if (sprite.image) {
    const row = def.directions?.[unit.facing] ?? 0;
    const sx = (def.idleFrame || 0) * def.frameWidth;
    const sy = row * def.frameHeight;
    const dx = px + Math.floor((TILE - def.drawWidth) / 2);
    const dy = py + 8;
    ctx.drawImage(sprite.image, sx, sy, def.frameWidth, def.frameHeight, dx, dy, def.drawWidth, def.drawHeight);
    return;
  }
  drawFallbackUnit(unit, px, py, def.fallbackColor);
}

function drawFallbackUnit(unit, px, py, color) {
  ctx.fillStyle = color || (unit.team === "ally" ? "#4f9cf9" : "#d75c4c");
  ctx.fillRect(px + 11, py + 9, 34, 38);
  ctx.fillStyle = "#161616";
  ctx.fillRect(px + 15, py + 15, 6, 6);
  ctx.fillRect(px + 34, py + 15, 6, 6);
  ctx.fillStyle = "#f5e6c8";
  ctx.fillRect(px + 15, py + 39, 26, 4);
}

function drawHpBar(u, x, y) {
  ctx.fillStyle = "#1c1614";
  ctx.fillRect(x, y, 44, 5);
  ctx.fillStyle = "#57d36b";
  ctx.fillRect(x, y, 44 * (u.hp / u.stats.maxHp), 5);
}

function drawFacing(u, px, py) {
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  const v = {
    right: [12, 0],
    left: [-12, 0],
    up: [0, -12],
    down: [0, 12]
  }[u.facing];
  ctx.fillStyle = "#fff2a8";
  ctx.beginPath();
  ctx.arc(cx + v[0], cy + v[1], 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawLegend() {
  ctx.fillStyle = "#f3f0e8";
  ctx.font = "16px Segoe UI";
  ctx.fillText(data.map.name, MAP_X, 24);
  ctx.font = "12px Segoe UI";
  ctx.fillText("Click highlighted cells. Direction marker shows facing.", MAP_X + 230, 24);
}

function drawCutin() {
  if (!cutin) return;
  const elapsed = performance.now() - cutin.startedAt;
  const t = clamp(elapsed / cutin.duration, 0, 1);
  const enter = clamp(t / 0.18, 0, 1);
  const exit = t > 0.78 ? 1 - clamp((t - 0.78) / 0.22, 0, 1) : 1;
  const alpha = Math.min(enter, exit);
  const slide = (1 - enter) * -220 + (t > 0.78 ? (1 - exit) * 220 : 0);
  const bandY = 210;
  const bandH = 190;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(slide, 0);

  ctx.fillStyle = cutin.def.bandColor || data.cutins.defaults.bandColor;
  ctx.fillRect(0, bandY, canvas.width, bandH);
  ctx.fillStyle = cutin.def.accentColor || data.cutins.defaults.accentColor;
  ctx.fillRect(0, bandY, canvas.width, 8);
  ctx.fillRect(0, bandY + bandH - 8, canvas.width, 8);

  if (cutin.def.image) {
    ctx.drawImage(cutin.def.image, 36, bandY - 18, 260, 226);
  } else {
    drawCutinPortraitFallback(cutin.unit, 58, bandY + 24, cutin.def.accentColor);
  }

  ctx.fillStyle = cutin.def.textColor || data.cutins.defaults.textColor;
  ctx.font = "700 22px Segoe UI";
  ctx.fillText(`${cutin.unit.name} / ${cutin.unit.class}`, 330, bandY + 54);
  ctx.font = "700 54px Segoe UI";
  ctx.fillText(cutin.skill.name, 330, bandY + 120);
  ctx.font = "16px Segoe UI";
  ctx.fillText(cutin.skill.type.toUpperCase(), 334, bandY + 152);
  ctx.restore();
}

function drawRpgOverlay() {
  if (!["town", "shop", "dungeon", "chapter"].includes(mode)) return;
  const x = MAP_X + 58;
  const y = MAP_Y + 58;
  const w = 760;
  const h = 520;
  ctx.save();
  ctx.fillStyle = "rgba(12, 11, 10, .88)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = mode === "shop" ? "#f0c15a" : ["dungeon", "chapter"].includes(mode) ? "#c994ff" : "#7ef0b4";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  if (mode === "town") drawTownOverlay(x, y, w, h);
  if (mode === "shop") drawShopOverlay(x, y, w, h);
  if (mode === "dungeon") drawDungeonOverlay(x, y, w, h);
  if (mode === "chapter") drawChapterOverlay(x, y, w, h);
  ctx.restore();
}

function drawTownOverlay(x, y, w) {
  const town = townData();
  const npc = selectedTownNpc();
  ctx.fillStyle = "#fff7e6";
  ctx.font = "700 32px Segoe UI";
  ctx.fillText(town.name, x + 30, y + 50);
  ctx.font = "15px Segoe UI";
  ctx.fillStyle = "#d2c3a1";
  ctx.fillText(`${town.region}    Gold ${gold}G`, x + 32, y + 78);
  ctx.fillStyle = "#fff7e6";
  ctx.font = "16px Segoe UI";
  wrapText(town.description, x + 32, y + 116, w - 64, 24);

  ctx.fillStyle = "#7ef0b4";
  ctx.font = "700 20px Segoe UI";
  ctx.fillText("Town Services", x + 32, y + 214);
  ctx.font = "15px Segoe UI";
  ctx.fillStyle = "#fff7e6";
  ctx.fillText(`Shop: ${data.shops[town.shopId]?.name || "-"}`, x + 48, y + 248);
  ctx.fillText(`Inn: ${town.inn?.name || "-"} / ${town.inn?.cost || 0}G`, x + 48, y + 276);
  ctx.fillText(`Dungeon: ${(town.dungeons || []).map(dungeon => dungeon.name).join(", ")}`, x + 48, y + 304);

  ctx.fillStyle = "#f0c15a";
  ctx.font = "700 20px Segoe UI";
  ctx.fillText("NPC", x + 32, y + 360);
  ctx.fillStyle = "rgba(240, 193, 90, .14)";
  ctx.fillRect(x + 42, y + 374, w - 84, 74);
  ctx.fillStyle = "#fff7e6";
  ctx.font = "700 17px Segoe UI";
  ctx.fillText(npc ? `${npc.name} / ${npc.role}` : "-", x + 58, y + 404);
  ctx.font = "14px Segoe UI";
  ctx.fillStyle = "#d2c3a1";
  wrapText(npc?.text || "", x + 58, y + 430, w - 116, 20);
  ctx.fillStyle = "#bcb4a7";
  ctx.font = "13px Segoe UI";
  ctx.fillText("Enter: talk    Tab/Arrows: next NPC", x + 32, y + 486);
}

function drawShopOverlay(x, y, w) {
  const shop = shopData();
  const stock = shop?.stock || [];
  ctx.fillStyle = "#fff7e6";
  ctx.font = "700 30px Segoe UI";
  ctx.fillText(shop?.name || "Shop", x + 30, y + 50);
  ctx.font = "15px Segoe UI";
  ctx.fillStyle = "#d2c3a1";
  ctx.fillText(`Gold ${gold}G    Enter: buy    Tab/Arrows: next item    Esc: town`, x + 32, y + 78);
  for (const [i, item] of stock.entries()) {
    const rowY = y + 122 + i * 54;
    ctx.fillStyle = i === shopCursor ? "rgba(240, 193, 90, .20)" : "rgba(255, 255, 255, .05)";
    ctx.fillRect(x + 34, rowY - 24, w - 68, 44);
    ctx.fillStyle = i === shopCursor ? "#f0c15a" : "#fff7e6";
    ctx.font = "700 16px Segoe UI";
    ctx.fillText(shopItemName(item), x + 52, rowY);
    ctx.fillStyle = "#d2c3a1";
    ctx.font = "13px Segoe UI";
    ctx.fillText(`${item.type.toUpperCase()}   ${item.price}G`, x + 320, rowY);
    ctx.fillText(item.description || "", x + 430, rowY);
  }
}

function drawDungeonOverlay(x, y, w) {
  const routes = townData().dungeons || [];
  const dungeon = routes[dungeonCursor] || null;
  const visibleCount = 5;
  const start = clamp(dungeonCursor - Math.floor(visibleCount / 2), 0, Math.max(0, routes.length - visibleCount));
  const visibleRoutes = routes.slice(start, start + visibleCount);
  ctx.fillStyle = "#fff7e6";
  ctx.font = "700 30px Segoe UI";
  ctx.fillText("Dungeon Routes", x + 30, y + 50);
  ctx.font = "15px Segoe UI";
  ctx.fillStyle = "#d2c3a1";
  ctx.fillText("Enter: start route    Tab/Arrows: next route    Esc: town", x + 32, y + 78);
  for (const [i, route] of visibleRoutes.entries()) {
    const routeIndex = start + i;
    const rowY = y + 128 + i * 72;
    ctx.fillStyle = routeIndex === dungeonCursor ? "rgba(201, 148, 255, .20)" : "rgba(255, 255, 255, .05)";
    ctx.fillRect(x + 34, rowY - 32, w - 68, 68);
    ctx.fillStyle = routeIndex === dungeonCursor ? "#c994ff" : "#fff7e6";
    ctx.font = "700 18px Segoe UI";
    ctx.fillText(route.name, x + 52, rowY);
    ctx.fillStyle = "#d2c3a1";
    ctx.font = "13px Segoe UI";
    ctx.fillText(`Threat: ${route.threat}    Size: ${route.mapSize}    Enemies: ${route.enemyCount}`, x + 52, rowY + 22);
    ctx.fillText(route.description || "", x + 52, rowY + 44);
  }
  if (dungeon) {
    ctx.fillStyle = "#f0c15a";
    ctx.font = "15px Segoe UI";
    ctx.fillText(`Selected ${dungeonCursor + 1}/${routes.length}: ${dungeon.name}`, x + 34, y + 486);
  }
}

function drawChapterOverlay(x, y, w) {
  const chapters = availableChapters();
  const visibleCount = 5;
  const start = clamp(chapterCursor - Math.floor(visibleCount / 2), 0, Math.max(0, chapters.length - visibleCount));
  const visibleChapters = chapters.slice(start, start + visibleCount);
  ctx.fillStyle = "#fff7e6";
  ctx.font = "700 30px Segoe UI";
  ctx.fillText("Story Chapters", x + 30, y + 50);
  ctx.font = "15px Segoe UI";
  ctx.fillStyle = "#d2c3a1";
  ctx.fillText(`Unlocked ${maxUnlockedChapter}/${data.chapters.totalChapters}    Enter: start    Tab/Arrows: next chapter    Esc: town`, x + 32, y + 78);
  for (const [i, chapter] of visibleChapters.entries()) {
    const route = (townData().dungeons || []).find(dungeon => dungeon.id === chapter.dungeonId);
    const rowY = y + 132 + i * 92;
    const selected = chapters.indexOf(chapter) === chapterCursor;
    ctx.fillStyle = selected ? "rgba(201, 148, 255, .20)" : "rgba(255, 255, 255, .05)";
    ctx.fillRect(x + 34, rowY - 34, w - 68, 72);
    ctx.fillStyle = selected ? "#c994ff" : "#fff7e6";
    ctx.font = "700 18px Segoe UI";
    ctx.fillText(`Chapter ${chapter.number}: ${chapter.title}`, x + 52, rowY - 6);
    ctx.fillStyle = completedChapters[chapter.id] ? "#7ef0b4" : "#d2c3a1";
    ctx.font = "13px Segoe UI";
    ctx.fillText(`${completedChapters[chapter.id] ? "Cleared" : "Open"}    Story ${chapter.storyMinutes}m / Battle ${chapter.battleMinutes}m`, x + 52, rowY + 18);
    ctx.fillText(`${route?.name || chapter.dungeonId}    Size ${route?.mapSize || "-"}    Enemies ${route?.enemyCount || "-"}`, x + 52, rowY + 40);
  }
  if (storyFlags.finalEndingReady) {
    ctx.fillStyle = "#f0c15a";
    ctx.font = "16px Segoe UI";
    ctx.fillText("Final ending flag is ready after Chapter 20.", x + 34, y + 486);
  } else {
    ctx.fillStyle = "#bcb4a7";
    ctx.font = "13px Segoe UI";
    ctx.fillText(`Showing ${start + 1}-${start + visibleChapters.length} of ${chapters.length} unlocked chapters`, x + 34, y + 486);
  }
}

function drawBattleOverlay() {
  if (mode === "scenario" || mode === "party" || (mode !== "briefing" && !battleOver)) return;
  ctx.save();
  ctx.fillStyle = "rgba(12, 11, 10, .78)";
  ctx.fillRect(MAP_X + 70, MAP_Y + 72, 700, 390);
  ctx.strokeStyle = mode === "victory" ? "#7ef0b4" : mode === "defeat" ? "#ff786b" : "#f0c15a";
  ctx.lineWidth = 3;
  ctx.strokeRect(MAP_X + 70, MAP_Y + 72, 700, 390);
  ctx.fillStyle = "#fff7e6";
  ctx.font = "700 34px Segoe UI";
  const title = mode === "briefing" ? selectedDungeon()?.name || data.map.briefing?.title || data.map.name : mode === "victory" ? "VICTORY" : "DEFEAT";
  ctx.fillText(title, MAP_X + 105, MAP_Y + 130);
  ctx.font = "18px Segoe UI";
  if (mode === "briefing") {
    drawOverlayLine(`Objective: ${data.map.briefing?.objective || "Defeat all enemies."}`, 180);
    drawOverlayLine(`Defeat: ${data.map.briefing?.defeat || "All allies defeated."}`, 210);
    ctx.fillStyle = "#d2c3a1";
    drawOverlayLine("Tips", 260);
    ctx.fillStyle = "#fff7e6";
    for (const [i, tip] of (data.map.briefing?.tips || []).entries()) drawOverlayLine(`- ${tip}`, 292 + i * 28);
    ctx.fillStyle = "#f0c15a";
    drawOverlayLine("Press START or Enter", 420);
  } else {
    const lines = resultText().split("\n");
    for (const [i, line] of lines.entries()) drawOverlayLine(line, 190 + i * 34);
    ctx.fillStyle = "#f0c15a";
    drawOverlayLine("Use RESTART for another run.", 420);
  }
  ctx.restore();
}

function drawOverlayLine(text, y) {
  ctx.fillText(text, MAP_X + 110, MAP_Y + y);
}

function currentScenarioLine() {
  if (!scenarioState) return null;
  return scenarioState.scene.lines[scenarioState.index] || null;
}

function drawScenarioOverlay() {
  if (mode !== "scenario" || !scenarioState) return;
  const line = currentScenarioLine();
  if (!line) return;
  const portrait = portraitAssets[line.portrait] || {};
  const def = { ...data.portraits.defaults, ...portrait };

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, .42)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const portraitX = MAP_X + 42;
  const portraitY = MAP_Y + 126;
  if (def.image) {
    ctx.drawImage(def.image, portraitX, portraitY, 210, 260);
  } else {
    drawPortraitFallback(line, portraitX, portraitY, def.accentColor);
  }

  const boxX = MAP_X + 40;
  const boxY = MAP_Y + 400;
  const boxW = 830;
  const boxH = 168;
  ctx.fillStyle = "rgba(18, 16, 14, .94)";
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = def.accentColor || data.portraits.defaults.accentColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = def.accentColor || data.portraits.defaults.accentColor;
  ctx.font = "700 20px Segoe UI";
  ctx.fillText(line.speaker, boxX + 24, boxY + 34);
  ctx.fillStyle = def.textColor || data.portraits.defaults.textColor;
  ctx.font = "20px Segoe UI";
  wrapText(line.text, boxX + 24, boxY + 72, boxW - 48, 30);
  ctx.fillStyle = "#d2c3a1";
  ctx.font = "13px Segoe UI";
  ctx.fillText(`${scenarioState.index + 1}/${scenarioState.scene.lines.length}  Click / Enter / Space`, boxX + boxW - 190, boxY + boxH - 18);
  ctx.restore();
}

function drawPartyOverlay() {
  if (mode !== "party") return;
  const unit = selectedPartyMember();
  if (!unit) return;
  const x = MAP_X + 54;
  const y = MAP_Y + 54;
  const w = 760;
  const h = 590;
  ctx.save();
  ctx.fillStyle = "rgba(12, 11, 10, .86)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#7ef0b4";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = "#fff7e6";
  ctx.font = "700 30px Segoe UI";
  ctx.fillText("Party Growth", x + 28, y + 46);
  ctx.font = "15px Segoe UI";
  ctx.fillStyle = "#d2c3a1";
  ctx.fillText(`Slot ${saveSlot}    Tab: unit    Arrows: skill    Enter: train    Esc: return`, x + 30, y + 76);

  const members = partyMembers();
  for (const [i, member] of members.entries()) {
    const rowY = y + 112 + i * 72;
    ctx.fillStyle = i === partyIndex ? "rgba(126, 240, 180, .20)" : "rgba(255, 255, 255, .05)";
    ctx.fillRect(x + 26, rowY - 26, 210, 58);
    ctx.fillStyle = i === partyIndex ? "#7ef0b4" : "#fff7e6";
    ctx.font = "700 18px Segoe UI";
    ctx.fillText(member.name, x + 44, rowY);
    ctx.font = "13px Segoe UI";
    ctx.fillStyle = "#d8d1c3";
    ctx.fillText(`Lv ${member.level}  EXP ${member.exp}/${expToNext(member)}  SP ${member.skillPoints || 0}`, x + 44, rowY + 22);
  }

  const sx = x + 280;
  const weapon = weaponOf(unit);
  const rankBonus = weaponRankBonus(unit);
  ctx.fillStyle = "#fff7e6";
  ctx.font = "700 24px Segoe UI";
  ctx.fillText(`${unit.name} / ${unit.class}`, sx, y + 120);
  ctx.font = "15px Segoe UI";
  const statLines = [
    `HP ${unit.hp}/${unit.stats.maxHp}   MP ${unit.mp}/${unit.stats.maxMp}`,
    `ATK ${unit.stats.attack}   DEF ${unit.stats.defense}   MAG ${unit.stats.magic}   MDF ${unit.stats.magicDefense}`,
    `SPD ${unit.stats.speed}   ACC ${unit.stats.accuracy}   EVA ${unit.stats.evasion}   MOV ${unit.stats.movement}`,
    `Weapon: ${weapon.name}  Range ${weapon.range[0]}-${weapon.range[1]}  Hit ${weapon.accuracy}`,
    `Weapon Rank: ${weaponTag(unit).toUpperCase()} ${weaponRank(unit)}  XP ${weaponProficiency[unit.id]?.[weaponTag(unit)] || 0}/90`,
    `Rank Bonus: ${Object.keys(rankBonus).length ? statDeltaLine({}, rankBonus, Object.keys(rankBonus)) : "None"}`,
    `Armor: ${equipmentName(unit.equipment?.armor)}`,
    `Accessory: ${equipmentName(unit.equipment?.accessory)}`
  ];
  for (const [i, text] of statLines.entries()) {
    ctx.fillStyle = i >= 3 ? "#d2c3a1" : "#fff7e6";
    ctx.fillText(text, sx, y + 154 + i * 22);
  }
  ctx.fillStyle = "#bcb4a7";
  ctx.font = "12px Segoe UI";
  ctx.fillText(weapon.description || "", sx + 12, y + 326);

  const nextWeapon = nextWeaponId(unit);
  const nextArmor = nextEquipmentId(unit, "armor");
  const nextAccessory = nextEquipmentId(unit, "accessory");
  const previewLines = [
    nextWeapon ? `Next Weapon: ${data.weapons[nextWeapon].name}  ${statDeltaLine(unit.stats, previewStats(unit, { weapon: nextWeapon }), ["attack", "magic", "accuracy"])}` : "Next Weapon: -",
    nextArmor ? `Next Armor: ${equipmentName(nextArmor)}  ${statDeltaLine(unit.stats, previewStats(unit, { equipment: { armor: nextArmor } }), ["maxHp", "defense", "magicDefense", "evasion"])}` : "Next Armor: -",
    nextAccessory ? `Next Acc: ${equipmentName(nextAccessory)}  ${statDeltaLine(unit.stats, previewStats(unit, { equipment: { accessory: nextAccessory } }), ["attack", "defense", "magic", "speed", "accuracy", "evasion", "movement"])}` : "Next Acc: -"
  ];
  ctx.fillStyle = "#f0c15a";
  ctx.font = "12px Segoe UI";
  for (const [i, text] of previewLines.entries()) ctx.fillText(text, sx, y + 350 + i * 18);

  const unlocked = new Set(unit.unlockedTree || []);
  const entries = skillTreeEntries(unit);
  ctx.fillStyle = "#fff7e6";
  ctx.font = "700 18px Segoe UI";
  ctx.fillText("Skill Tree", sx, y + 424);
  ctx.font = "14px Segoe UI";
  if (entries.length) {
    for (const [i, { id, node }] of entries.entries()) {
      const learned = unlocked.has(id);
      const available = availableSkillNodes(unit).some(item => item.id === id);
      const selected = i === partyTreeIndex;
      if (selected) {
        ctx.fillStyle = "rgba(240, 193, 90, .18)";
        ctx.fillRect(sx - 10, y + 432 + i * 26, 450, 24);
      }
      ctx.fillStyle = learned ? "#7ef0b4" : available ? "#f0c15a" : "#8e8678";
      ctx.fillText(`${selected ? ">" : " "} ${learned ? "OK" : available ? "NEW" : "--"} ${node.name}  Cost ${node.cost}`, sx, y + 450 + i * 26);
      ctx.fillStyle = "#bcb4a7";
      ctx.font = "12px Segoe UI";
      ctx.fillText(node.description || "", sx + 34, y + 464 + i * 26);
      ctx.font = "14px Segoe UI";
    }
  }
  ctx.restore();
}

function drawConfirmDialog() {
  if (mode !== "party" || !confirmDialog) return;
  const unit = units.find(u => u.id === confirmDialog.unitId);
  const node = data.skilltrees[unit?.class]?.nodes[confirmDialog.nodeId];
  if (!unit || !node) return;
  const x = MAP_X + 176;
  const y = MAP_Y + 186;
  const w = 520;
  const h = 190;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, .48)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(18, 16, 14, .96)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#f0c15a";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#fff7e6";
  ctx.font = "700 24px Segoe UI";
  ctx.fillText("Unlock Skill Node?", x + 28, y + 44);
  ctx.font = "16px Segoe UI";
  ctx.fillText(`${unit.name}: ${node.name}  Cost ${node.cost} SP`, x + 28, y + 82);
  ctx.fillStyle = "#d2c3a1";
  wrapText(node.description || "", x + 28, y + 112, w - 56, 22);
  ctx.fillStyle = "#7ef0b4";
  ctx.font = "14px Segoe UI";
  ctx.fillText(skillNodeSummary(node), x + 28, y + 154);
  ctx.fillStyle = "#f0c15a";
  ctx.fillText("CONFIRM / Enter     CANCEL / Esc", x + 28, y + 178);
  ctx.restore();
}

function drawPortraitFallback(line, x, y, color) {
  ctx.fillStyle = color || "#f0c15a";
  ctx.fillRect(x, y, 180, 230);
  ctx.fillStyle = "#151311";
  ctx.fillRect(x + 38, y + 58, 28, 28);
  ctx.fillRect(x + 114, y + 58, 28, 28);
  ctx.fillStyle = "#fff7e6";
  ctx.fillRect(x + 50, y + 150, 80, 12);
  ctx.strokeStyle = "#fff7e6";
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, 180, 230);
  ctx.fillStyle = "#151311";
  ctx.font = "700 18px Segoe UI";
  ctx.fillText(line.speaker.slice(0, 12), x + 18, y + 210);
  ctx.lineWidth = 1;
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

function drawCutinPortraitFallback(unit, x, y, color) {
  ctx.fillStyle = color || (unit.team === "ally" ? "#4f9cf9" : "#d75c4c");
  ctx.fillRect(x, y, 150, 126);
  ctx.fillStyle = "#141414";
  ctx.fillRect(x + 28, y + 36, 20, 20);
  ctx.fillRect(x + 100, y + 36, 20, 20);
  ctx.fillStyle = "#fff7e6";
  ctx.fillRect(x + 38, y + 92, 74, 10);
  ctx.strokeStyle = "#fff7e6";
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, 150, 126);
  ctx.lineWidth = 1;
}

boot().catch(err => {
  ui.phase.textContent = "LOAD ERROR";
  ui.log.textContent = String(err);
  console.error(err);
});
