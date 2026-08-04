const VERSION = "v1.0.0";

const sampleHand = {
  tiles: [
    "一萬",
    "二萬",
    "三萬",
    "四筒",
    "五筒",
    "六筒",
    "七条",
    "八条",
    "九条",
    "中",
    "中",
    "中",
    "白",
    "白",
  ],
  fans: [
    { name: "平胡", fan: 1, reason: "基础顺子结构完整" },
    { name: "箭刻", fan: 2, reason: "三张红中组成刻子" },
    { name: "自摸", fan: 1, reason: "Demo默认本局自摸" },
  ],
};

const ruleCopy = {
  guangdong: "广东推倒胡",
  sichuan: "四川血战到底",
  hangzhou: "杭州麻将",
};

let currentResult = null;
let bills = [
  {
    player: "阿妞",
    rule: "广东推倒胡",
    fan: 4,
    points: 8,
    money: 48,
    time: "样例记录 1",
  },
  {
    player: "阿妞",
    rule: "广东推倒胡",
    fan: 2,
    points: 4,
    money: -12,
    time: "样例记录 2",
  },
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function activateStep(id) {
  $$(".step-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.stepTarget === id);
  });
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function formatMoney(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}¥${Math.abs(value)}`;
}

function getSettings() {
  const rule = $("#ruleSelect").value;
  const basePoint = Number($("#basePoint").value || 1);
  const opponentCount = Number($("#opponentCount").value || 3);
  return {
    rule,
    ruleName: ruleCopy[rule],
    basePoint,
    opponentCount,
    player: $("#playerName").value.trim() || "演示用户",
  };
}

function calculateScore() {
  const settings = getSettings();
  const fan = sampleHand.fans.reduce((sum, item) => sum + item.fan, 0);
  const points = fan * settings.basePoint;
  const money = points * settings.opponentCount * 2;

  currentResult = {
    ...settings,
    version: VERSION,
    tiles: sampleHand.tiles,
    fans: sampleHand.fans,
    fan,
    points,
    money,
  };

  renderRecognition();
  renderScore();
}

function renderRecognition() {
  const output = $("#recognitionOutput");
  output.innerHTML = `
    <p class="muted">已识别 ${sampleHand.tiles.length} 张牌，规则口径：${currentResult.ruleName}。如现场识别有误，可用手动修正兜底。</p>
    <div class="tile-row" aria-label="识别出的麻将牌">
      ${sampleHand.tiles.map((tile) => `<span class="tile-chip">${tile}</span>`).join("")}
    </div>
  `;
}

function renderScore() {
  if (!currentResult) {
    return;
  }

  $("#totalFan").textContent = currentResult.fan;
  $("#totalPoints").textContent = currentResult.points;
  $("#totalMoney").textContent = formatMoney(currentResult.money);
  $("#fanList").innerHTML = currentResult.fans
    .map(
      (item) => `
        <div class="fan-item">
          <div>
            <strong>${item.name}</strong>
            <p class="muted">${item.reason}</p>
          </div>
          <span>${item.fan} 番</span>
        </div>
      `,
    )
    .join("");
}

function saveBill() {
  if (!currentResult) {
    calculateScore();
  }

  bills.unshift({
    player: currentResult.player,
    rule: currentResult.ruleName,
    fan: currentResult.fan,
    points: currentResult.points,
    money: currentResult.money,
    time: new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });

  renderHistory();
  activateStep("history");
}

function renderHistory() {
  const roundCount = bills.length;
  const net = bills.reduce((sum, bill) => sum + bill.money, 0);
  const best = Math.max(...bills.map((bill) => bill.money), 0);

  $("#roundCount").textContent = roundCount;
  $("#netMoney").textContent = formatMoney(net);
  $("#bestRound").textContent = formatMoney(best);

  const positiveRounds = bills.filter((bill) => bill.money > 0).length;
  const highFanRounds = bills.filter((bill) => bill.fan >= 4).length;
  const style =
    highFanRounds >= 2
      ? "高番偏好"
      : positiveRounds >= Math.ceil(roundCount / 2)
        ? "稳定进账"
        : "需要控损";

  $("#insightText").textContent = `${style}：最近 ${roundCount} 局净胜负 ${formatMoney(net)}。建议继续记录更多牌局，优先观察高番牌型出现频率和自摸收益。`;

  $("#historyList").innerHTML = bills
    .map(
      (bill) => `
        <div class="bill-row">
          <div>
            <strong>${bill.player} · ${bill.rule}</strong>
            <small>${bill.time} · ${bill.fan} 番 · ${bill.points} 点</small>
          </div>
          <strong>${formatMoney(bill.money)}</strong>
        </div>
      `,
    )
    .join("");
}

function previewUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    $("#photoPreview").style.background = `center / cover no-repeat url("${reader.result}")`;
    $("#photoPreview").innerHTML = "";
  };
  reader.readAsDataURL(file);
}

function resetSamplePreview() {
  $("#photoPreview").removeAttribute("style");
  $("#photoPreview").innerHTML = `
    <div class="photo-table">
      ${sampleHand.tiles.map((tile) => `<span class="${tile === "中" ? "red" : ""}">${tile}</span>`).join("")}
    </div>
  `;
}

$$(".step-tab").forEach((tab) => {
  tab.addEventListener("click", () => activateStep(tab.dataset.stepTarget));
});

$("#startDemo").addEventListener("click", () => activateStep("recognize"));
$("#useSample").addEventListener("click", resetSamplePreview);
$("#recognizeBtn").addEventListener("click", () => {
  calculateScore();
  activateStep("result");
});
$("#recalculateBtn").addEventListener("click", calculateScore);
$("#saveBillBtn").addEventListener("click", saveBill);
$("#imageInput").addEventListener("change", previewUpload);

renderHistory();
