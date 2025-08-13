　let qrReader;

　const GAS_URL = "https://script.google.com/macros/s/AKfycbygpqW4VYNm__Wip39CwAwoyitrTi4CPAg4N6lH7WPOPkcU37LbzS2XiNn-xvWzEI84/exec";
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbzPp8txbAQKRbIl_vzsf-S5v4D78lx4fFttikHh_Cv9bsUBDHWmQAliTFWTCYIujAug/exec";
  const gas_URL = "https://script.google.com/macros/s/AKfycbzPUOz4eCsZ7RVm4Yf_VPu1OC5nn2yIOPa5U-tT7ZMHpw0FRNsHaqovbX7vSaEHjPc/exec";
  const SECRET = 'kosen-brain-super-secret';
　const secret = 'kosen'
  const SCAN_COOLDOWN_MS = 1500;
  const POLL_INTERVAL_MS = 20_000;
  const MAX_PLAYERS_PER_SEAT = 6;
// データ構造と状態
  let currentSeatId   = null;
  let seatMap         = {};      // { table01: [player01, …] }
  let playerData      = {};      // { playerId: {rate,…} }
  let actionHistory   = [];

  let undoStack = [];
  let redoStack = [];

  let qrActive = false;         // ← グローバル保持して二重起動防止
  let rankingQrReader = null;
  let isRankCameraStarting = false;
  let isScanCameraStarting = false;

  let isRankingMode   =false;
  let rankingSeatId   = null;

  let lastScannedText = null;
  let lastScanTime    = 0;
  let msgTimer        = null;

  let pollTimer = null;
  let douTakuRecords = [];

  let lastScrollTop = 0;
  let scrollTimeout;

  let scanQr;
  let rankQr;

  let isNavigating = false;

  let currentRankingSeatId = null;
  /* ======== ユーティリティ ======== */
const delay = ms => new Promise(res => setTimeout(res, ms));

function displayMessage(msg) {
  const area = document.getElementById("messageArea");
  if (!area) return;
  area.textContent = msg;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => (area.textContent = ""), 3000);
}

function navigateAsync(sectionId) {
  return new Promise(resolve => {
    if (isNavigating) {
      console.warn("すでに遷移中なのでスキップします");
      resolve();
      return;
    }
    isNavigating = true;

    document.querySelectorAll('.section').forEach(el => el.style.display = 'none');
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';

    location.hash = sectionId;

    setTimeout(() => {
      isNavigating = false;
      resolve();
    }, 300);
  });
}

function confirmRanking() {
  return window.confirm("この順位で確定してもよろしいですか？");
}

/* ======== QR 読み取りコールバック ======== */
function handleScanSuccess(decodedText) {
  const now = Date.now();
  if (decodedText === lastScannedText && now - lastScanTime < SCAN_COOLDOWN_MS) return;
  lastScannedText = decodedText;
  lastScanTime = now;

  const resultEl = document.getElementById("result");
  if (resultEl) resultEl.textContent = `📷 ${decodedText} を読み取りました`;

  if (decodedText.startsWith("table")) {
    currentSeatId = decodedText;
    seatMap[currentSeatId] ??= [];
    displayMessage(`✅ 座席セット: ${currentSeatId}`);

    if (isRankingMode) {
      handleRankingScan(decodedText);
    }
  } else if (decodedText.startsWith("player")) {
    if (!currentSeatId) {
      displayMessage("⚠ 先に座席QRを読み込んでください");
      return;
    }
    if (seatMap[currentSeatId].includes(decodedText)) {
      displayMessage("⚠ 既に登録済み");
      return;
    }
    if (seatMap[currentSeatId].length >= 6) {
      displayMessage("⚠ この座席は6人まで");
      return;
    }

    seatMap[currentSeatId].push(decodedText);
    playerData[decodedText] ??= { nickname: decodedText, rate: 50, lastRank: null, bonus: 0 };
    saveAction({ type: "addPlayer", seatId: currentSeatId, playerId: decodedText });
    displayMessage(`✅ ${decodedText} 追加`);
    saveToLocalStorage();
    renderSeats();

    // ここでGASに送信
    sendSeatData(currentSeatId, seatMap[currentSeatId], 'イチゴ大福');

    // 以下はハイライト処理のまま
    const seatList = document.getElementById("seatList");
    if (seatList) {
      const seatDiv = [...seatList.children].find(div => div.querySelector("strong")?.textContent === currentSeatId);
      if (seatDiv) {
        const playerEntry = [...seatDiv.querySelectorAll(".player-entry")].find(entry =>
          entry.querySelector("strong")?.textContent === decodedText
        );
        if (playerEntry) {
          playerEntry.classList.add("highlighted");
          setTimeout(() => {
            playerEntry.classList.remove("highlighted");
          }, 1500);
        }
      }
    }
  }
}
  /* ======== 座席表示 ======== */ 
function renderSeats() {
  const seatList = document.getElementById("seatList");
  seatList.innerHTML = "";

  for (const [seatId, players] of Object.entries(seatMap)) {
    const seatDiv = document.createElement("div");
    seatDiv.className = "seat-box";
    seatDiv.innerHTML = `<strong>${seatId}</strong>`;

    players.forEach(playerId => {
      const player = playerData[playerId] || { rate: 0 };
      const bonus = player.bonus ?? 0;
      const title = player.title ?? "";

      const entryDiv = document.createElement("div");
      entryDiv.className = "player-entry";

      // プレイヤー情報表示
      entryDiv.innerHTML = `
        <div>
          <strong>${playerId}</strong>
          ${title ? `<span class="title-badge title-${title}">${title}</span>` : ""}
          <span style="margin-left:10px;color:#888;">Rate: ${player.rate}</span>
          <span class="rate-change ${bonus > 0 ? "rate-up" : bonus < 0 ? "rate-down" : "rate-zero"}">
            ${bonus > 0 ? "↑" : bonus < 0 ? "↓" : "±"}${Math.abs(bonus)}
          </span>
        </div>
      `;

      // ✖ボタン（スコープをしっかり閉じる）
      const removeBtn = document.createElement("span");
      removeBtn.className = "remove-button";
      removeBtn.textContent = "✖";
      removeBtn.addEventListener("click", () => {
        // undo登録
        undoStack.push({ type: "remove", seatId: seatId, playerId: playerId });

        // 削除処理
        seatMap[seatId] = seatMap[seatId].filter(id => id !== playerId);
        if (seatMap[seatId].length === 0) {
          delete seatMap[seatId];
        }
        if (seatMap[seatId]) {
          seatMap[seatId] = seatMap[seatId].filter(id => id !== playerId);
        }

        saveToLocalStorage();
        renderSeats();
      });

      entryDiv.appendChild(removeBtn);
      seatDiv.appendChild(entryDiv);
    });

    seatList.appendChild(seatDiv);
  }
}

  function removePlayer(seatId, playerId) {
    const idx = seatMap[seatId]?.indexOf(playerId);
    if (idx === -1) return;
    seatMap[seatId].splice(idx, 1);
    actionHistory.push({ type: "removePlayer", seatId, playerId, index: idx });
    saveToLocalStorage();
    renderSeats();
  }
 
function navigate(targetId) {
  // 全セクション非表示
  document.querySelectorAll('.section').forEach(section => {
    section.style.display = 'none';
  });

  // ターゲットセクションだけ表示
  const target = document.getElementById(targetId);
  if (target) {
    target.style.display = 'block';
    location.hash = targetId;  // URLハッシュ変更（オプション）
  } else {
    console.warn(`指定されたセクション "${targetId}" は存在しません。`);
    return;
  }

  // セクション固有の処理
  switch (targetId) {
    case 'historySection':
      loadDouTakuHistory();
      break;

    case 'rankingSection':
      isRankingMode  = true;
      rankingSeatId  = null;
      document.getElementById("rankingList").innerHTML = "";
      displayMessage("座席QR を読み込んでください（順位登録モード）");

      break;

 case 'scanSection':
  isRankingMode = false;
  if (rankingQrReader) {
    rankingQrReader.stop()
      .then(() => rankingQrReader.clear())
      .then(() => {
        rankingQrReader = null;
        if (!qrActive) startScanCamera();
      })
      .catch(e => {
        console.error("順位登録カメラ停止エラー:", e);
        if (!qrActive) startScanCamera();
      });
  } else {
    if (!qrActive) startScanCamera();
  }
  break;
  }
}
// --- Undo/Redo ---
  // 操作を保存（何かアクションがあったときに毎回呼ぶ）
function saveAction(action) {
  undoStack.push(action);
  redoStack = []; // 新しい操作をしたらREDO履歴は消す
}

// UNDO
function undoAction() {
  if (!undoStack.length) {
    displayMessage("元に戻す操作がありません");
    return;
  }

  const last = undoStack.pop();
  redoStack.push(last); // REDOできるように保存

  switch (last.type) {
    case "addPlayer":
      seatMap[last.seatId] = seatMap[last.seatId].filter(p => p !== last.playerId);
      break;

    case "removePlayer":
      seatMap[last.seatId]?.splice(last.index, 0, last.playerId);
      break;

    case "removeSeat":
      seatMap[last.seatId] = last.players;
      break;
  }

  displayMessage("↩ 元に戻しました");
  saveToLocalStorage();
  renderSeats();
}

// REDO
function redoAction() {
  if (!redoStack.length) {
    displayMessage("やり直す操作がありません");
    return;
  }

  const last = redoStack.pop();
  undoStack.push(last); // REDOしたらまたUNDOできるように戻す

  switch (last.type) {
    case "addPlayer":
      seatMap[last.seatId] = seatMap[last.seatId] || [];
      seatMap[last.seatId].push(last.playerId);
      break;

    case "removePlayer":
      seatMap[last.seatId] = seatMap[last.seatId].filter(p => p !== last.playerId);
      break;

    case "removeSeat":
      delete seatMap[last.seatId];
      break;
  }

  displayMessage("↪ やり直しました");
  saveToLocalStorage();
  renderSeats();
}

// 銅鐸履歴描画関数
function loadDouTakuHistory() {
  const douTakuRecords = JSON.parse(localStorage.getItem("douTakuRecords") || "[]");
  const savedPlayerData = JSON.parse(localStorage.getItem("playerData") || "{}");
  const savedSeatMap = JSON.parse(localStorage.getItem("seatMap") || "{}");

  const list = document.getElementById("historyList");
  list.innerHTML = "";

  if (douTakuRecords.length === 0) {
    list.innerHTML = "<p>🔕 履歴がありません</p>";
    return;
  }

  douTakuRecords.forEach(record => {
    const playerId = record.playerId;
    const nickname = savedPlayerData[playerId]?.nickname ?? playerId;

    // 座席を seatMap から探索
    const seatId = Object.entries(savedSeatMap).find(([, players]) =>
      players.includes(playerId)
    )?.[0] ?? "?";

    const item = document.createElement("div");
    item.className = "history-entry";
    item.innerText = `🔔 ${nickname} さん（座席 ${seatId}）が ${record.time} に鳴らしました`;
    list.appendChild(item);
  });
}

  // --- ローカル保存・復元 ---
function saveToLocalStorage() {
  localStorage.setItem("seatMap", JSON.stringify(seatMap));
  localStorage.setItem("playerData", JSON.stringify(playerData));
}

// ローカルストレージから読み込み
function loadFromLocalStorage() {
  const savedSeatMap = localStorage.getItem("seatMap");
  const savedPlayerData = localStorage.getItem("playerData");

  if (savedSeatMap) {
    try {
      seatMap = JSON.parse(savedSeatMap);
    } catch (e) {
      console.warn("座席データの復元に失敗", e);
      seatMap = {};
    }
  }

  if (savedPlayerData) {
    try {
      playerData = JSON.parse(savedPlayerData);
    } catch (e) {
      console.warn("プレイヤーデータの復元に失敗", e);
      playerData = {};
    }
  }

  renderSeats(); // 復元後に描画
}

    /* ---- 順位登録モード ---- */
function handleRankingScan(decodedText) {
  console.log("順位登録読み取り:", decodedText);
  const seatId = decodedText.trim();
  currentRankingSeatId = seatId;
  
  if (!seatMap[seatId]) {
    displayMessage(`⚠️ 未登録の座席ID: ${seatId}`);
    return;
  }

  const playerIds = seatMap[seatId];
  if (!playerIds.length) {
    displayMessage("⚠️ この座席にはプレイヤーが登録されていません");
    return;
  }

  const list = document.getElementById("rankingList");
  list.innerHTML = ""; // 既存リストをクリア

  playerIds.forEach(pid => {
    const p = playerData[pid] || {};
    const item = document.createElement("li");
    item.className = "draggable-item";
    item.draggable = true;
    item.dataset.id = pid;
    item.innerHTML = `
      <strong>${pid}</strong> ${p.name ? `(${p.name})` : ""}
      ${p.title ? `<span class="title-badge">${p.title}</span>` : ""}
      <span class="rate">Rate: ${p.rate ?? 0}</span>
    `;
    list.appendChild(item);
  });

  enableDragSort("rankingList");
  displayMessage(`✅ 座席 ${seatId} のプレイヤーを読み込みました`);
}

function enableDragSort(listId) {
  const list = document.getElementById(listId);
  let dragged;

  list.querySelectorAll(".draggable-item").forEach(item => {
    item.addEventListener("dragstart", e => {
      dragged = item;
      item.classList.add("dragging");
    });

    item.addEventListener("dragend", e => {
      item.classList.remove("dragging");
    });

    item.addEventListener("dragover", e => e.preventDefault());

    item.addEventListener("drop", e => {
      e.preventDefault();
      if (dragged && dragged !== item) {
        const items = Array.from(list.children);
        const draggedIndex = items.indexOf(dragged);
        const dropIndex = items.indexOf(item);
        if (draggedIndex < dropIndex) {
          list.insertBefore(dragged, item.nextSibling);
        } else {
          list.insertBefore(dragged, item);
        }
      }
    });
  });
}

function startRankCamera() {
  const targetId = "rankingReader";
  const el = document.getElementById(targetId);
  if (!el) {
    console.error("❌ rankingReader が見つかりません");
    return;
  }

  if (isRankCameraStarting) {
    console.log("順位登録カメラ起動中または起動処理中のためスキップ");
    return;
  }
  isRankCameraStarting = true;

  function initAndStartRankQr() {
    rankQr = new Html5Qrcode(targetId);
    const config = { fps: 10, qrbox: { width: 200, height: 200 } };
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
      console.log("🎯 順位登録 QR:", decodedText);
      handleRankingScan(decodedText);
    };
    return rankQr.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
      .then(() => console.log("✅ 順位登録カメラ起動"))
      .catch(err => {
        console.error("❌ 順位登録カメラ起動エラー:", err);
        displayMessage("❌ 順位登録カメラの起動に失敗しました");
        throw err;
      });
  }

  if (rankQr) {
    rankQr.stop()
      .then(() => rankQr.clear())
      .then(() => initAndStartRankQr())
      .catch(err => {
        console.error("❌ カメラ再起動エラー:", err);
        displayMessage("❌ 順位登録カメラの再起動に失敗しました");
      })
      .finally(() => {
        isRankCameraStarting = false;
      });
  } else {
    initAndStartRankQr()
      .finally(() => {
        isRankCameraStarting = false;
      });
  }
}

function startScanCamera() {
  const targetId = "reader";  // プレイヤースキャン用QR表示エリアID
  const el = document.getElementById(targetId);
  if (!el) {
    console.error("❌ reader が見つかりません");
    return;
  }

  if (isScanCameraStarting) {
    console.log("プレイヤーカメラ起動中または起動処理中のためスキップ");
    return;
  }
  isScanCameraStarting = true;

  function initAndStartScanQr() {
    scanQr = new Html5Qrcode(targetId);
    const config = {
      fps: 10,
      qrbox: 350
    };
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
      handleScanSuccess(decodedText);
    };
    return scanQr.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
      .then(() => console.log("✅ プレイヤーカメラ起動"))
      .catch(err => {
        console.error("❌ プレイヤーカメラ起動エラー:", err);
        displayMessage("❌ プレイヤーカメラの起動に失敗しました");
        throw err;
      });
  }

  if (scanQr) {
    scanQr.stop()
      .then(() => scanQr.clear())
      .then(() => initAndStartScanQr())
      .catch(err => {
        console.error("❌ プレイヤーカメラ再起動エラー:", err);
        displayMessage("❌ プレイヤーカメラの再起動に失敗しました");
      })
      .finally(() => {
        isScanCameraStarting = false;
      });
  } else {
    initAndStartScanQr()
      .finally(() => {
        isScanCameraStarting = false;
      });
  }
}

window.stopScanCamera = async function () {
  if (scanQr) {
    try {
      await scanQr.stop();
      await scanQr.clear();
      scanQr = null;
      console.log("🛑 プレイヤー管理カメラ停止");
    } catch (err) {
      console.error("❌ プレイヤーカメラ停止失敗:", err);
    }
  }
};

window.stopRankCamera = async function () {
  if (rankQr) {
    try {
      await rankQr.stop();
      await rankQr.clear();
      rankQr = null;
      console.log("🛑 順位登録カメラ停止");
    } catch (err) {
      console.error("❌ カメラ停止失敗:", err);
    }
  }
};

window.enterScanMode = async function () {
  await stopRankCamera();
  await navigateAsync('scanSection');   // 遷移完了まで待つ
  startScanCamera();
};

window.enterRankMode = async function () {
  await stopScanCamera();
  await navigateAsync('rankingEntrySection');  // <- DOM表示完了を待つ
  startRankCamera();                           // <- 表示された後に起動
};

window.exitRankMode = async function () {
  await stopRankCamera();                     // 順位カメラ停止
  await navigateAsync('scanSection');         // プレイヤーモードに戻る
  startScanCamera();                          // プレイヤーカメラ起動
};

async function finalizeRanking() {
  const list = document.getElementById("rankingList");
  const rankedIds = Array.from(list.children).map(li => li.dataset.id);

  if (rankedIds.length < 2) {
    displayMessage("⚠️ 2人以上で順位を登録してください");
    return;
  }

  calculateRate(rankedIds);

  const entries = rankedIds.map((playerId, index) => ({
    playerId,
    rank: index + 1,
    rate: playerData[playerId]?.rate ?? 100
  }));

  const success = await postRankingUpdate(entries);

  if (!success) {
    displayMessage("❌ 順位の送信に失敗しました");
    return;
  }

  saveToLocalStorage();
  displayMessage("✅ 順位を確定しました");

  const rankings = rankedIds.map((pid, index) => {
    const p = playerData[pid];
    return {
      playerId: pid,
      rank: index + 1,
      rate: p.rate,
      rateDelta: p.rateDelta,
      bonus: p.bonus,
      lastRank: p.lastRank,
      title: p.title || null,
    };
  });

  const minimalPlayerData = {};
  rankedIds.forEach(pid => {
    minimalPlayerData[pid] = playerData[pid];
  });

  const postData = { rankings, playerData: minimalPlayerData };

  const onSendSuccess = () => {
    if (currentRankingSeatId && seatMap[currentRankingSeatId]) {
      seatMap[currentRankingSeatId] = [];
      saveToLocalStorage();
      displayMessage(`✅ 座席 ${currentRankingSeatId} の結びつきを解除しました。再登録可能です。`);
      if (list) list.innerHTML = "";
      currentRankingSeatId = null;
    }
  };

  onSendSuccess(); // 今は成功直後に実行
}

  // ランキング用送信関数
async function postRankingUpdate(entries) {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: SECRET,
        entries: entries
      })
    });

    if (!res.ok) {
      console.error(`HTTP error: ${res.status}`);
      return false;
    }

    const data = await res.json();

    if (data.error) {
      console.error("サーバーエラー:", data.error);
      return false;
    }

    return true;

  } catch (err) {
    console.error("送信エラー:", err);
    return false;
  }
}
/* ---------- レート計算まわり ---------- */
function calculateRate(rankedIds) {
  rankedIds.forEach((pid, i) => {
    const p        = playerData[pid];
    const prevRank = p.lastRank ?? rankedIds.length;
    let diff       = prevRank - (i + 1);          // ↑なら正

    // 基本ポイント
    let point = diff * 2;

    // 特殊ルール
    if (prevRank === 1 && i === rankedIds.length - 1) point = -8;
    if (prevRank === rankedIds.length && i === 0)      point =  8;

    // 高レート補正
    if (p.rate >= 80) point = Math.floor(point * 0.8);

    // 王座奪取ボーナス
    const topId = getTopRatedPlayerId();
    if (topId && p.rate <= playerData[topId].rate && i + 1 < playerData[topId].lastRank)
      point += 2;

    p.bonus = point;
    p.rate  = Math.max(30, p.rate + point);
  });

  assignTitles();
}

/** 称号を付与（👑🥈🥉） */
function assignTitles() {
  Object.values(playerData).forEach(p => (p.title = null));      // 一旦クリア
  Object.entries(playerData)
        .sort((a,b) => b[1].rate - a[1].rate)
        .slice(0,3)                                              // 上位 3 人
        .forEach(([pid], idx) => {
          playerData[pid].title = ["👑 王者", "🥈 挑戦者", "🥉 鬼気迫る者"][idx];
        });
}

function getTopRatedPlayerId() {
  let topId = null;
  let topRate = -Infinity;
  for (const [pid, pdata] of Object.entries(playerData)) {
    if (pdata.rate > topRate) {
      topRate = pdata.rate;
      topId = pid;
    }
  }
  return topId;
}
//---GAS---
async function saveToGAS(seatMap, playerData) {
  
  const formData = new URLSearchParams();
  formData.append('secret', SECRET);
  formData.append('data', JSON.stringify({ seatMap, playerData }));

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      mode: 'cors' // これでCORS対応
    });
    const json = await res.json();
    console.log('保存成功:', json);
  } catch (err) {
    console.error('保存失敗:', err);
  }
}

// GASからデータを読み込み
async function loadFromGAS() {
  try {
    const res = await fetch(GAS_URL, { method: 'GET' });
    const json = await res.json();
    seatMap = json.seatMap || {};
    playerData = json.playerData || {};
    console.log('読み込み完了:', seatMap, playerData);
    alert('読み込みに成功しました');
    // ここで画面に反映する処理を呼ぶ
  } catch (err) {
    console.error('読み込みエラー:', err);
    alert('読み込みに失敗しました');
  }
}

// 既にある関数 sendSeatData をここにコピペしてください
async function sendSeatData(tableID, playerIds, operator = 'webUser') {
  const postData = {
    mode: 'updatePlayers',
    tableID: tableID,
    players: JSON.stringify(playerIds),  // 配列は文字列に
    operator: operator,
  };

  const formBody = new URLSearchParams(postData).toString();

  fetch(gas_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: formBody,
  })
  .then(res => res.json())
  .then(json => console.log('送信結果:', json))
  .catch(e => console.error('送信失敗:', e));
  }
  // --- CSVエクスポート ---
  window.exportPlayerCSV = () => {
    const players = [];
    
   Object.entries(seatMap).forEach(([seatID, playerList]) => {
      playerList.forEach(playerID => {
        players.push({
          playerID,
          seatID,
          rate: playerData[playerID]?.rate ?? 0
        });
      });
    });

    if(players.length === 0){
      alert("エクスポートする生徒データがありません。");
      return;
    }
    const headers = ["playerID","seatID","rate"];
    const csv = toCSV(players, headers);
    downloadCSV(csv, "players.csv");
  };

  function exportSeatCSV() {
  const seatData = Object.entries(seatMap).map(([seatID, players]) => ({
    seatID,
    players: players.join(";")
  }));

  if (seatData.length === 0) {
    alert("エクスポートする座席データがありません。");
    return;
  }

  const headers = ["seatID", "players"];
  const csv = toCSV(seatData, headers);
  downloadCSV(csv, "seats.csv");
}

  function downloadCSV(csvText, filename){
    const blob = new Blob([csvText], {type: "text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }


// 対戦離席履歴サンプル
const leaveRecords = [
  { playerID:"player~0003", time:"2025-07-21 15:30", reason:"通信切断" },
  { playerID:"player~0010", time:"2025-07-22 18:45", reason:"トイレ離席" }
];

// CSV生成ユーティリティ
function toCSV(data, headers) {
  const csvRows = [];
  csvRows.push(headers.join(","));
  data.forEach(row => {
    const vals = headers.map(h=>{
      let v = row[h] ?? "";
      if(typeof v === "string" && v.includes(",")) v = `"${v.replace(/"/g,'""')}"`;
      return v;
    });
    csvRows.push(vals.join(","));
  });
  return csvRows.join("\n");
}

// 対戦離席CSV出力関数
function exportLeaveCSV() {
  if(leaveRecords.length === 0){
    alert("対戦離席データがありません。");
    return;
  }
  const headers = ["playerID","time","reason"];
  const csv = toCSV(leaveRecords, headers);
  downloadCSV(csv, "leave_records.csv");
}

  // --- サイドバー スクロールで自動閉じ ---

  window.addEventListener("scroll", () => {
    if(scrollTimeout) clearTimeout(scrollTimeout);
    const st = window.pageYOffset || document.documentElement.scrollTop;
    if(st > lastScrollTop){
      sidebar.classList.add("closed");
    } else {
      sidebar.classList.remove("closed");
    }
    lastScrollTop = st <= 0 ? 0 : st;
    scrollTimeout = setTimeout(() => sidebar.classList.remove("closed"), 1500);
  });

  /* ボタンへのイベント付与など既存の bindButtons() を呼び出す */
function bindButtons() {
  document.getElementById("undoBtn")?.addEventListener("click", undoAction);
  document.getElementById("redoBtn")?.addEventListener("click", redoAction);
  document.getElementById("exportPlayerBtn")?.addEventListener("click", exportPlayerCSV);
  document.getElementById("exportSeatBtn")?.addEventListener("click", exportSeatCSV);
  document.getElementById("exportLeaveBtn")?.addEventListener("click", exportLeaveCSV);
  document.getElementById("confirmRankingBtn")?.addEventListener("click", confirmRanking);
  document.getElementById("saveToGASBtn")?.addEventListener("click", () => saveToGAS(seatMap, playerData));
  document.getElementById("loadFromGASBtn").addEventListener("click", loadFromGAS);
  document.getElementById("exitRankBtn").addEventListener("click", exitRankMode);
  document.getElementById("confirmRankingBtn")?.addEventListener("click", finalizeRanking);
}

  // 初期化
document.addEventListener("DOMContentLoaded", () => {
  loadFromLocalStorage();
  renderSeats();
  bindButtons();
});

Object.assign(window, {
  navigate,
  navigateToExternal: url => window.open(url, "_blank"),
  undoAction,
  redoAction,
  removePlayer,
  exportPlayerCSV,
  exportSeatCSV,
  exportLeaveCSV,
  confirmRanking
});
