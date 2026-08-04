const VERSION = "v2.1.0";
const STORAGE_KEY = "huliao-demo-v2.1";

const routes = ["home", "create", "join", "room", "settle", "ai", "summary", "history"];
const winds = ["东", "南", "西", "北"];
const avatarColors = ["#0f6a55", "#b33b33", "#305c89", "#9a6a22"];

const fanOptions = [
  { id: "selfDraw", name: "自摸", fan: 1, reason: "赢家自摸，三家支付" },
  { id: "allTriplets", name: "碰碰胡", fan: 3, reason: "四组刻子结构" },
  { id: "sevenPairs", name: "七小对", fan: 4, reason: "七组对子成牌" },
  { id: "pureSuit", name: "清一色", fan: 6, reason: "同一花色成牌" },
  { id: "dragonSet", name: "箭刻", fan: 2, reason: "中发白刻子" },
  { id: "kong", name: "杠上开花", fan: 2, reason: "开杠后补牌胡" },
];

const aiSamples = [
  {
    title: "清一色 · 自摸",
    confidence: 96,
    tiles: ["一筒", "二筒", "三筒", "三筒", "四筒", "五筒", "五筒", "六筒", "七筒", "七筒", "八筒", "九筒", "九筒", "九筒"],
    reasons: [
      ["牌型", "全部识别为筒子，满足清一色"],
      ["番数", "清一色 6 番，自摸 1 番，合计 7 番"],
      ["依据", "14 张牌数量完整，雀头与顺子结构可解释"],
    ],
    selectedFans: ["selfDraw", "pureSuit"],
  },
  {
    title: "七小对 · 自摸",
    confidence: 93,
    tiles: ["一萬", "一萬", "三萬", "三萬", "五筒", "五筒", "七筒", "七筒", "二条", "二条", "八条", "八条", "發", "發"],
    reasons: [
      ["牌型", "识别到七组对子结构"],
      ["番数", "七小对 4 番，自摸 1 番，合计 5 番"],
      ["依据", "没有孤张，成牌结构稳定"],
    ],
    selectedFans: ["selfDraw", "sevenPairs"],
  },
  {
    title: "碰碰胡 · 红中刻",
    confidence: 91,
    tiles: ["二萬", "二萬", "二萬", "五筒", "五筒", "五筒", "七条", "七条", "七条", "中", "中", "中", "白", "白"],
    reasons: [
      ["牌型", "四组刻子加一组对子"],
      ["番数", "碰碰胡 3 番，箭刻 2 番，合计 5 番"],
      ["依据", "红中三张置信度均高于 90%"],
    ],
    selectedFans: ["allTriplets", "dragonSet"],
  },
];

const state = {
  route: "home",
  routeStack: ["home"],
  roomCode: "HL-0826",
  rule: "宁波麻将",
  baseScore: 2,
  cap: 64,
  group: "周六固定局",
  selectedAvatar: 0,
  aiIndex: 0,
  players: [
    { id: "p1", name: "阿妞", score: 0, lastDelta: 0, wind: "东", badge: "房主", color: avatarColors[0] },
    { id: "p2", name: "小林", score: 0, lastDelta: 0, wind: "南", badge: "牌友", color: avatarColors[1] },
    { id: "p3", name: "陈姐", score: 0, lastDelta: 0, wind: "西", badge: "牌友", color: avatarColors[2] },
    { id: "p4", name: "老周", score: 0, lastDelta: 0, wind: "北", badge: "牌友", color: avatarColors[3] },
  ],
  rounds: [],
  disputes: [],
  histories: [],
  pendingPayments: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function money(value) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}¥${Math.abs(value)}`;
}

function point(value) {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value}`;
}

function initials(name) {
  return name.slice(0, 1) || "胡";
}

function routeTo(id, push = true) {
  if (!routes.includes(id)) return;
  state.route = id;
  $$(".page").forEach((page) => page.classList.toggle("active", page.id === id));
  if (push && state.routeStack[state.routeStack.length - 1] !== id) {
    state.routeStack.push(id);
  }
  render();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function goBack() {
  if (state.routeStack.length <= 1) {
    routeTo("home", false);
    return;
  }
  state.routeStack.pop();
  routeTo(state.routeStack[state.routeStack.length - 1], false);
}

function playerById(id) {
  return state.players.find((player) => player.id === id) || state.players[0];
}

function generateRoomCode() {
  const part = Math.floor(1000 + Math.random() * 9000);
  state.roomCode = `HL-${part}`;
}

function resetCurrentMatch() {
  state.players.forEach((player, index) => {
    player.score = 0;
    player.lastDelta = 0;
    player.wind = winds[index];
    player.badge = index === 0 ? "房主" : "牌友";
  });
  state.rounds = [];
  state.disputes = [];
  state.pendingPayments = [];
  state.aiIndex = 0;
}

function saveToStorage() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: VERSION,
      players: state.players,
      rounds: state.rounds,
      disputes: state.disputes,
      histories: state.histories,
      roomCode: state.roomCode,
      rule: state.rule,
      baseScore: state.baseScore,
      cap: state.cap,
      group: state.group,
    }),
  );
}

function loadFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    Object.assign(state, saved);
    state.route = "home";
    state.routeStack = ["home"];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function renderQr() {
  const qr = $("#qrGrid");
  if (!qr) return;
  const bits = Array.from({ length: 81 }, (_, index) => {
    const code = state.roomCode.charCodeAt(index % state.roomCode.length);
    return (index + code + Math.floor(index / 3)) % 3 === 0;
  });
  qr.innerHTML = bits.map((bit) => `<span class="${bit ? "dark" : ""}"></span>`).join("");
}

function renderPlayerEditor() {
  const editor = $("#playerEditor");
  if (!editor) return;
  editor.innerHTML = state.players
    .map(
      (player, index) => `
        <label class="player-input">
          <span class="avatar" style="background:${player.color}">${winds[index]}</span>
          <input data-player-name="${player.id}" type="text" value="${player.name}" />
        </label>
      `,
    )
    .join("");
}

function renderAvatarPicker() {
  const picker = $("#avatarPicker");
  if (!picker) return;
  picker.innerHTML = avatarColors
    .map(
      (color, index) => `
        <button class="avatar-option ${state.selectedAvatar === index ? "active" : ""}" data-avatar="${index}">
          <span class="avatar" style="background:${color}">${index + 1}</span>
        </button>
      `,
    )
    .join("");
}

function renderFriends() {
  const target = $("#friendGroup");
  if (!target) return;
  target.innerHTML = state.players
    .map(
      (player) => `
        <div class="friend-chip">
          <span class="avatar" style="background:${player.color}">${initials(player.name)}</span>
          <strong>${player.name}</strong>
          <span>${player.badge}</span>
        </div>
      `,
    )
    .join("");
}

function renderRanks() {
  const ranks = [...state.players].sort((a, b) => b.score - a.score);
  const html = ranks
    .map(
      (player, index) => `
        <div class="rank-item">
          <span>${index + 1}. ${player.name}</span>
          <strong class="${player.score >= 0 ? "positive" : "negative-text"}">${point(player.score)}</strong>
        </div>
      `,
    )
    .join("");
  if ($("#homeRanks")) $("#homeRanks").innerHTML = html;
}

function renderScoreboard() {
  const board = $("#scoreboard");
  if (!board) return;
  board.innerHTML = state.players
    .map(
      (player) => `
        <article class="player-card">
          <div class="player-top">
            <div class="player-name">
              <span class="avatar" style="background:${player.color}">${initials(player.name)}</span>
              <div>
                <span class="wind">${player.wind}风</span>
                <h3>${player.name}</h3>
              </div>
            </div>
            <span class="badge">${player.badge}</span>
          </div>
          <p class="score-value ${player.score >= 0 ? "positive" : "negative-text"}">${point(player.score)}</p>
          <span class="delta ${player.lastDelta < 0 ? "negative" : ""}">${point(player.lastDelta)} 本局</span>
          <div class="badge-row">
            <span class="badge">胜率 ${player.score > 0 ? "62%" : "41%"}</span>
            <span class="badge">累计 ${money(player.score)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderLedger() {
  const ledger = $("#ledgerList");
  if (!ledger) return;
  const latest = [...state.rounds].slice(-5).reverse();
  ledger.innerHTML = latest.length
    ? latest
        .map(
          (round) => `
            <div class="ledger-item">
              <div>
                <strong>第 ${round.no} 局 · ${round.winner}</strong>
                <span>${round.fans.join("、")} · ${round.payers.join("、")} 支付</span>
              </div>
              <strong class="positive">+${round.total}</strong>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">暂无单局流水</div>`;
}

function renderHighlights() {
  const high = [...state.players].sort((a, b) => b.score - a.score)[0];
  const low = [...state.players].sort((a, b) => a.score - b.score)[0];
  const target = $("#highlightGrid");
  if (!target) return;
  target.innerHTML = `
    <div class="highlight-item"><span>今日雀神</span><strong>${high.name}</strong></div>
    <div class="highlight-item"><span>点炮担当</span><strong>${low.name}</strong></div>
    <div class="highlight-item"><span>已打局数</span><strong>${state.rounds.length}</strong></div>
    <div class="highlight-item"><span>AI 裁判</span><strong>${state.disputes.length}</strong></div>
  `;
}

function renderSelects() {
  const winner = $("#winnerSelect");
  const loser = $("#loserSelect");
  if (!winner || !loser) return;
  const currentWinner = winner.value || state.players[0].id;
  const currentLoser = loser.value;
  const options = state.players.map((player) => `<option value="${player.id}">${player.name}</option>`).join("");
  winner.innerHTML = options;
  winner.value = currentWinner;
  loser.innerHTML = state.players
    .filter((player) => player.id !== winner.value)
    .map((player) => `<option value="${player.id}">${player.name}</option>`)
    .join("");
  if (currentLoser && currentLoser !== winner.value) {
    loser.value = currentLoser;
  }
}

function renderFanPicker(selected = ["selfDraw"]) {
  const picker = $("#fanPicker");
  if (!picker) return;
  picker.innerHTML = fanOptions
    .map(
      (fan) => `
        <button class="fan-option ${selected.includes(fan.id) ? "active" : ""}" data-fan="${fan.id}">
          <strong>${fan.name}</strong>
          <span>${fan.fan} 番 · ${fan.reason}</span>
        </button>
      `,
    )
    .join("");
}

function selectedFans() {
  const active = $$(".fan-option.active").map((button) => button.dataset.fan);
  return active.length ? active : ["selfDraw"];
}

function calculatePayments() {
  const winner = playerById($("#winnerSelect")?.value);
  const mode = $("#payerMode")?.value || "all";
  const loser = playerById($("#loserSelect")?.value);
  const direct = Number($("#directAmount")?.value || 0);
  const multiplier = Number($("#multiplierInput")?.value || 1);
  const selected = selectedFans();
  const fanTotal = selected.reduce((sum, id) => sum + (fanOptions.find((fan) => fan.id === id)?.fan || 0), 0);
  const autoAmount = Math.min(state.cap || Infinity, state.baseScore * Math.max(1, fanTotal) * multiplier);
  const amount = direct > 0 ? direct : autoAmount;
  const payers = mode === "all" ? state.players.filter((player) => player.id !== winner.id) : [loser];

  state.pendingPayments = payers.map((payer) => ({
    from: payer.id,
    to: winner.id,
    amount,
    fans: selected.map((id) => fanOptions.find((fan) => fan.id === id)?.name).filter(Boolean),
  }));
  renderPayments();
}

function renderPayments() {
  const list = $("#paymentList");
  const total = state.pendingPayments.reduce((sum, item) => sum + item.amount, 0);
  if ($("#settleTotal")) $("#settleTotal").textContent = `¥${total}`;
  if (!list) return;
  list.innerHTML = state.pendingPayments.length
    ? state.pendingPayments
        .map((item) => {
          const from = playerById(item.from);
          const to = playerById(item.to);
          return `
            <div class="payment-item">
              <div>
                <strong>${from.name} → ${to.name}</strong>
                <span>${item.fans.join("、") || "直接输入金额"}</span>
              </div>
              <strong>¥${item.amount}</strong>
            </div>
          `;
        })
        .join("")
    : `<div class="empty-state">等待计算</div>`;
}

function confirmSettle() {
  if (!state.pendingPayments.length) calculatePayments();
  if (!state.pendingPayments.length) return;
  state.players.forEach((player) => {
    player.lastDelta = 0;
  });

  state.pendingPayments.forEach((payment) => {
    const from = playerById(payment.from);
    const to = playerById(payment.to);
    from.score -= payment.amount;
    from.lastDelta -= payment.amount;
    to.score += payment.amount;
    to.lastDelta += payment.amount;
  });

  const first = state.pendingPayments[0];
  state.rounds.push({
    no: state.rounds.length + 1,
    winner: playerById(first.to).name,
    payers: state.pendingPayments.map((payment) => playerById(payment.from).name),
    amount: first.amount,
    fans: first.fans,
    total: state.pendingPayments.reduce((sum, payment) => sum + payment.amount, 0),
  });

  state.pendingPayments = [];
  saveToStorage();
  routeTo("room");
}

function renderAi() {
  const sample = aiSamples[state.aiIndex % aiSamples.length];
  if ($("#aiTiles")) {
    $("#aiTiles").innerHTML = sample.tiles
      .map((tile) => `<span class="tile ${tile === "中" || tile === "發" ? "red" : tile === "白" ? "green" : ""}">${tile}</span>`)
      .join("");
  }
  if ($("#aiResultTitle")) $("#aiResultTitle").textContent = sample.title;
  if ($("#confidenceText")) $("#confidenceText").textContent = `${sample.confidence}%`;
  if ($("#confidenceBar")) $("#confidenceBar").style.width = `${sample.confidence}%`;
  if ($("#reasonList")) {
    $("#reasonList").innerHTML = sample.reasons
      .map(
        ([label, copy]) => `
          <div class="reason-item">
            <strong>${label}</strong>
            <span>${copy}</span>
          </div>
        `,
      )
      .join("");
  }
}

function applyAiToSettle() {
  const sample = aiSamples[state.aiIndex % aiSamples.length];
  renderFanPicker(sample.selectedFans);
  routeTo("settle");
  calculatePayments();
}

function saveDispute() {
  const sample = aiSamples[state.aiIndex % aiSamples.length];
  state.disputes.unshift({
    title: sample.title,
    confidence: sample.confidence,
    time: `第 ${state.rounds.length + 1} 局`,
    note: "已保存",
  });
  saveToStorage();
  renderDisputes();
}

function renderSummary() {
  const final = $("#finalScoreboard");
  if (!final) return;
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  final.innerHTML = sorted
    .map(
      (player) => `
        <div class="final-player">
          <span>${player.badge}</span>
          <h3>${player.name}</h3>
          <strong class="${player.score >= 0 ? "positive" : "negative-text"}">${point(player.score)}</strong>
        </div>
      `,
    )
    .join("");

  const winners = sorted.filter((player) => player.score > 0);
  const losers = sorted.filter((player) => player.score < 0).reverse();
  const transfers = [];
  let wi = 0;
  let li = 0;
  let receive = winners[wi] ? winners[wi].score : 0;
  let pay = losers[li] ? Math.abs(losers[li].score) : 0;
  while (winners[wi] && losers[li]) {
    const amount = Math.min(receive, pay);
    transfers.push({ from: losers[li].name, to: winners[wi].name, amount });
    receive -= amount;
    pay -= amount;
    if (receive === 0) {
      wi += 1;
      receive = winners[wi] ? winners[wi].score : 0;
    }
    if (pay === 0) {
      li += 1;
      pay = losers[li] ? Math.abs(losers[li].score) : 0;
    }
  }

  $("#transferList").innerHTML = transfers.length
    ? transfers
        .map(
          (item) => `
            <div class="transfer-item">
              <span>${item.from} 转给 ${item.to}</span>
              <strong>¥${item.amount}</strong>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">当前总账已平</div>`;

  const winner = sorted[0];
  $("#posterWinner").innerHTML = `
    <span>今日雀神</span>
    <strong>${winner.name}</strong>
    <span>${money(winner.score)}</span>
  `;
  $("#posterStats").innerHTML = `
    <div class="poster-stat"><span>总局数</span><strong>${state.rounds.length}</strong></div>
    <div class="poster-stat"><span>AI 裁判</span><strong>${state.disputes.length}</strong></div>
    <div class="poster-stat"><span>地区规则</span><strong>${state.rule}</strong></div>
    <div class="poster-stat"><span>房间码</span><strong>${state.roomCode}</strong></div>
  `;
}

function renderHistory() {
  const history = $("#matchHistory");
  if (!history) return;
  history.innerHTML = state.histories.length
    ? state.histories
        .map(
          (item) => `
            <div class="history-item">
              <div>
                <strong>${item.group}</strong>
                <span>${item.time} · ${item.rounds} 局</span>
              </div>
              <strong>${item.winner}</strong>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">暂无保存的整场牌局</div>`;
}

function renderRoundArchive() {
  const archive = $("#roundArchive");
  if (!archive) return;
  const rounds = [...state.rounds].reverse();
  archive.innerHTML = rounds.length
    ? rounds
        .map(
          (round) => `
            <div class="history-item">
              <div>
                <strong>第 ${round.no} 局 · ${round.winner}</strong>
                <span>${round.fans.join("、") || "直接输入金额"} · ${round.payers.join("、")} 支付</span>
              </div>
              <strong class="positive">+${round.total}</strong>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">本场还没有结算记录</div>`;
}

function renderDisputes() {
  const list = $("#disputeList");
  if (!list) return;
  list.innerHTML = state.disputes.length
    ? state.disputes
        .map(
          (item) => `
            <div class="dispute-item">
              <div>
                <strong>${item.title}</strong>
                <span>${item.time} · 置信度 ${item.confidence}%</span>
              </div>
              <span>${item.note}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">暂无 AI 争议记录</div>`;
}

function saveMatch() {
  const winner = [...state.players].sort((a, b) => b.score - a.score)[0];
  state.histories.unshift({
    group: state.group,
    winner: `${winner.name} ${money(winner.score)}`,
    rounds: state.rounds.length,
    time: new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
  });
  saveToStorage();
  renderHistory();
}

function continueRound() {
  state.players.forEach((player, index) => {
    player.lastDelta = 0;
    player.wind = winds[(index + state.rounds.length) % winds.length];
  });
  saveToStorage();
  routeTo("room");
}

function renderHeaderData() {
  const round = state.rounds.length + 1;
  const leader = [...state.players].sort((a, b) => b.score - a.score)[0];
  $("#homeRoomCode").textContent = state.roomCode;
  $("#homeRound").textContent = round;
  $("#homeNet").textContent = point(leader.score);
  $("#roomCodeText").textContent = state.roomCode;
  $("#roomRule").textContent = state.rule;
  $("#roundNumber").textContent = round;
  $("#createRoomCode").textContent = state.roomCode;
  $("#inviteCode").textContent = state.roomCode;
}

function renderBottomNav() {
  $$(".bottom-nav [data-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === state.route);
  });
}

function renderJoinPreview() {
  const preview = $("#joinPreview");
  if (!preview) return;
  preview.innerHTML = state.players
    .map(
      (player) => `
        <div class="rank-item">
          <span>${player.name}</span>
          <strong>${point(player.score)}</strong>
        </div>
      `,
    )
    .join("");
}

function render() {
  renderHeaderData();
  renderQr();
  renderPlayerEditor();
  renderAvatarPicker();
  renderFriends();
  renderRanks();
  renderScoreboard();
  renderLedger();
  renderHighlights();
  renderSelects();
  renderPayments();
  renderAi();
  renderSummary();
  renderHistory();
  renderRoundArchive();
  renderDisputes();
  renderJoinPreview();
  renderBottomNav();
}

function bindEvents() {
  $$("[data-route]").forEach((button) => {
    button.dataset.boundDirect = "true";
    button.addEventListener("click", () => routeTo(button.dataset.route));
  });

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton && !routeButton.dataset.boundDirect) {
      routeTo(routeButton.dataset.route);
    }

    if (event.target.closest("[data-back]")) {
      goBack();
    }

    const avatar = event.target.closest("[data-avatar]");
    if (avatar) {
      state.selectedAvatar = Number(avatar.dataset.avatar);
      renderAvatarPicker();
    }

    const fan = event.target.closest("[data-fan]");
    if (fan) {
      fan.classList.toggle("active");
      calculatePayments();
    }
  });

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (input.matches("[data-player-name]")) {
      const player = playerById(input.dataset.playerName);
      player.name = input.value.trim() || player.name;
      saveToStorage();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-player-name]")) {
      render();
    }
  });

  $("#createRoomBtn").addEventListener("click", () => {
    state.rule = $("#ruleSelect").value;
    state.baseScore = Number($("#baseScore").value || 2);
    state.cap = Number($("#capSelect").value || 0);
    state.group = $("#groupSelect").value;
    generateRoomCode();
    resetCurrentMatch();
    saveToStorage();
    render();
    routeTo("room");
  });

  $("#joinRoomBtn").addEventListener("click", () => {
    const name = $("#joinName").value.trim();
    if (name) {
      const player = state.players[1];
      player.name = name;
      player.color = avatarColors[state.selectedAvatar];
    }
    state.roomCode = ($("#joinCode").value.trim() || state.roomCode).toUpperCase();
    saveToStorage();
    routeTo("room");
  });

  $("#winnerSelect").addEventListener("change", () => {
    renderSelects();
    calculatePayments();
  });
  $("#payerMode").addEventListener("change", calculatePayments);
  $("#loserSelect").addEventListener("change", calculatePayments);
  $("#multiplierInput").addEventListener("input", calculatePayments);
  $("#directAmount").addEventListener("input", calculatePayments);
  $("#calcSettleBtn").addEventListener("click", calculatePayments);
  $("#confirmSettleBtn").addEventListener("click", confirmSettle);

  $("#handImageInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    $("#uploadLabel").textContent = file ? file.name : "上传牌面照片";
  });
  $("#runAiBtn").addEventListener("click", () => {
    state.aiIndex += 1;
    renderAi();
  });
  $("#applyAiBtn").addEventListener("click", applyAiToSettle);
  $("#saveDisputeBtn").addEventListener("click", saveDispute);
  $("#saveMatchBtn").addEventListener("click", saveMatch);
  $("#newRoundBtn").addEventListener("click", continueRound);
}

loadFromStorage();
renderFanPicker();
bindEvents();
calculatePayments();
render();
routeTo("home", false);
console.info(`胡了吗 ${VERSION} ready`);
