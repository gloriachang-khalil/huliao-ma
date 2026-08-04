const VERSION = "v1.2.0";

const hands = {
  arrowPinghu: {
    label: "平胡 + 红中刻 + 自摸",
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
  },
  sevenPairs: {
    label: "七小对 + 自摸",
    tiles: [
      "一萬",
      "一萬",
      "三萬",
      "三萬",
      "五筒",
      "五筒",
      "七筒",
      "七筒",
      "二条",
      "二条",
      "八条",
      "八条",
      "發",
      "發",
    ],
    fans: [
      { name: "七小对", fan: 4, reason: "七组对子组成胡牌" },
      { name: "自摸", fan: 1, reason: "Demo默认本局自摸" },
    ],
  },
  pureSuit: {
    label: "清一色 + 平胡 + 自摸",
    tiles: [
      "一筒",
      "二筒",
      "三筒",
      "三筒",
      "四筒",
      "五筒",
      "五筒",
      "六筒",
      "七筒",
      "七筒",
      "八筒",
      "九筒",
      "九筒",
      "九筒",
    ],
    fans: [
      { name: "清一色", fan: 6, reason: "全部牌均为筒子一种花色" },
      { name: "平胡", fan: 1, reason: "顺子结构可解释" },
      { name: "自摸", fan: 1, reason: "Demo默认本局自摸" },
    ],
  },
};

const ruleCopy = {
  guangdong: "广东推倒胡",
  sichuan: "四川血战到底",
  hangzhou: "杭州麻将",
};

let currentResult = null;
let uploadedFile = null;
let uploadedImageName = "";
let latestDetection = null;
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
    fan: 5,
    points: 10,
    money: -30,
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

function getSelectedHand() {
  return hands[$("#handScenario").value] || hands.arrowPinghu;
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

function buildFansFromTiles(tiles) {
  if (!tiles.length) {
    return getSelectedHand().fans;
  }

  const counts = tiles.reduce((acc, tile) => {
    acc[tile] = (acc[tile] || 0) + 1;
    return acc;
  }, {});
  const suits = new Set(
    tiles
      .filter((tile) => /[萬筒条]$/.test(tile))
      .map((tile) => tile.slice(-1)),
  );
  const pairs = Object.values(counts).filter((count) => count === 2).length;
  const triples = Object.entries(counts).filter(([, count]) => count >= 3);
  const fans = [];

  if (pairs >= 7) {
    fans.push({ name: "七小对", fan: 4, reason: "识别结果中存在七组对子结构" });
  }
  if (suits.size === 1 && tiles.length >= 9) {
    fans.push({ name: "清一色", fan: 6, reason: "识别结果主要集中在一种花色" });
  }
  triples.forEach(([tile]) => {
    if (["中", "發", "白", "东", "南", "西", "北"].includes(tile)) {
      fans.push({ name: `${tile}刻`, fan: 2, reason: `识别到三张或更多 ${tile}` });
    }
  });
  fans.push({ name: "自摸", fan: 1, reason: "Demo默认本局自摸" });

  return fans.length ? fans : [{ name: "基础胡牌", fan: 1, reason: "YOLO已识别牌面，番种可继续人工确认" }];
}

function calculateScore(source = "fallback") {
  const settings = getSettings();
  const selectedHand = getSelectedHand();
  const tiles =
    source === "model" && latestDetection?.tiles?.length
      ? latestDetection.tiles
      : selectedHand.tiles;
  const fans =
    source === "model" && latestDetection?.tiles?.length
      ? buildFansFromTiles(latestDetection.tiles)
      : selectedHand.fans;
  const fan = fans.reduce((sum, item) => sum + item.fan, 0);
  const points = fan * settings.basePoint;
  const money = points * settings.opponentCount * 2;

  currentResult = {
    ...settings,
    version: VERSION,
    source:
      source === "model"
        ? `YOLO识别：${uploadedImageName || "上传图片"}`
        : uploadedImageName
          ? `上传图片 + 样例兜底：${uploadedImageName}`
          : "稳定样例",
    label: source === "model" ? "YOLO识别牌面" : selectedHand.label,
    tiles,
    fans,
    fan,
    points,
    money,
  };

  renderRecognition();
  renderScore();
}

function renderRecognition() {
  if (!currentResult) {
    return;
  }

  $("#recognitionOutput").innerHTML = `
    <p class="muted">识别来源：${currentResult.source}。当前确认结果为：${currentResult.label}。</p>
    <div class="tile-row" aria-label="确认后的麻将牌">
      ${currentResult.tiles.map((tile) => `<span class="tile-chip">${tile}</span>`).join("")}
    </div>
  `;
}

function renderModelOutput(payload) {
  latestDetection = payload;
  const warning =
    payload.tile_count && payload.tile_count !== 14 && payload.tile_count !== 17
      ? `<div class="warn-box">检测到 ${payload.tile_count} 张牌，和常见胡牌展示数量不完全一致，建议现场保留人工校正兜底。</div>`
      : "";

  $("#modelOutput").innerHTML = `
    <p class="muted">模型：${payload.model_version} · 检测数量：${payload.tile_count} · 平均置信度：${Math.round(payload.average_confidence * 100)}%</p>
    <div class="tile-row" aria-label="YOLO识别出的麻将牌">
      ${payload.tiles.map((tile) => `<span class="tile-chip">${tile}</span>`).join("")}
    </div>
    ${warning}
    <table class="detection-table">
      <thead>
        <tr>
          <th>牌</th>
          <th>类别</th>
          <th>置信度</th>
        </tr>
      </thead>
      <tbody>
        ${payload.detections
          .map(
            (item) => `
              <tr>
                <td>${item.tile}</td>
                <td>${item.class_name}</td>
                <td>${Math.round(item.confidence * 100)}%</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
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

async function recognizeWithYolo() {
  if (!uploadedFile) {
    $("#modelOutput").innerHTML = `<div class="warn-box">请先上传一张麻将牌面图片，或使用稳定样例继续演示。</div>`;
    calculateScore("fallback");
    activateStep("result");
    return;
  }

  $("#recognitionOutput").innerHTML = `<p class="muted">正在调用本地 YOLO 模型识别，请稍等。</p>`;
  $("#modelOutput").innerHTML = `<p class="muted">YOLO识别中...</p>`;

  const formData = new FormData();
  formData.append("image", uploadedFile);

  try {
    const response = await fetch("/api/recognize", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "识别服务返回异常");
    }
    renderModelOutput(payload);
    calculateScore("model");
  } catch (error) {
    $("#modelOutput").innerHTML = `
      <div class="warn-box">YOLO服务暂不可用：${error.message}。请确认已用 Flask 启动 v1.2，或使用样例兜底。</div>
    `;
    calculateScore("fallback");
  }

  activateStep("result");
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
  const highFanRounds = bills.filter((bill) => bill.fan >= 5).length;
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

  uploadedFile = file;
  uploadedImageName = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    $("#photoPreview").style.background = `center / cover no-repeat url("${reader.result}")`;
    $("#photoPreview").innerHTML = "";
    $("#recognitionOutput").innerHTML = `
      <p class="muted">已上传 ${file.name}。点击“YOLO识别牌面”调用本地模型。</p>
    `;
  };
  reader.readAsDataURL(file);
}

function resetSamplePreview() {
  uploadedFile = null;
  uploadedImageName = "";
  latestDetection = null;
  const selectedHand = getSelectedHand();
  $("#photoPreview").removeAttribute("style");
  $("#photoPreview").innerHTML = `
    <div class="photo-table">
      ${selectedHand.tiles.map((tile) => `<span class="${tile === "中" || tile === "發" ? "red" : ""}">${tile}</span>`).join("")}
    </div>
  `;
  $("#recognitionOutput").innerHTML = `
    <p class="muted">已切换到稳定样例：${selectedHand.label}。可以直接确认识别并算分。</p>
  `;
  $("#modelOutput").innerHTML = `
    <p class="muted">当前使用稳定样例，未调用 YOLO 模型。</p>
  `;
  calculateScore("fallback");
}

$$(".step-tab").forEach((tab) => {
  tab.addEventListener("click", () => activateStep(tab.dataset.stepTarget));
});

$("#startDemo").addEventListener("click", () => activateStep("recognize"));
$("#useSample").addEventListener("click", resetSamplePreview);
$("#handScenario").addEventListener("change", resetSamplePreview);
$("#recognizeBtn").addEventListener("click", recognizeWithYolo);
$("#recalculateBtn").addEventListener("click", () => calculateScore(latestDetection ? "model" : "fallback"));
$("#saveBillBtn").addEventListener("click", saveBill);
$("#imageInput").addEventListener("change", previewUpload);

renderHistory();
