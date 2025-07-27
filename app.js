　let qrReader;

　const GAS_URL = "https://script.google.com/macros/s/AKfycbygpqW4VYNm__Wip39CwAwoyitrTi4CPAg4N6lH7WPOPkcU37LbzS2XiNn-xvWzEI84/exec";
  const SECRET = 'kosen-brain-super-secret';
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
  /* ======== ユーティリティ ======== */
const delay = ms => new Promise(res => setTimeout(res, ms));

function displayMessage(msg) {
  const area = document.getElementById("messageArea");
  if (!area) return;
  area.textContent = msg;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => (area.textContent = ""), 3000);
}

window.navigate = function (sectionId) {
  document.querySelectorAll('.section').forEach(el => el.style.display = 'none');
  const target = document.getElementById(sectionId);
  if (target) target.style.display = 'block';
};

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

    // 座席コードのときだけ順位登録モードが有効なら呼ぶ
    if (isRankingMode) {
      handleRankingMode(decodedText);
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
  }
}

/* ======== カメラ起動 ======== */
function initCamera() {
  // 順位登録用QRリーダーが動いていたら停止
  if (rankingQrReader) {
    rankingQrReader.stop().then(() => {
      rankingQrReader.clear();
      rankingQrReader = null;
    }).catch(err => {
      console.error("rankingQrReader停止エラー:", err);
    });
  }

  // すでにスキャン中なら起動しない
  if (qrActive) {
    console.log("QR リーダーはすでに起動中です");
    return;
  }

  // インスタンス未生成なら作成
  if (!qrReader) qrReader = new Html5Qrcode("reader");

  qrReader.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 350 },
    handleScanSuccess
  ).then(() => {
    qrActive = true;
  }).catch(err => {
    console.error(err);
    displayMessage("❌ カメラの起動に失敗しました");
  });
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
        rankingQrReader.stop().then(() => {
          rankingQrReader.clear();
          rankingQrReader = null;
        });
      }
      if (!qrActive) initCamera();  // QRスキャン画面ならカメラを再起動
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

  if (rankQr) {
    console.log("⏹️ すでにカメラ起動中（停止して再起動）");
    rankQr.stop()
      .then(() => {
        return rankQr.clear();
      })
      .then(() => {
        initAndStartRankQr();
      })
      .catch(err => {
        console.error("❌ カメラ再起動エラー:", err);
        displayMessage("❌ 順位登録カメラの再起動に失敗しました");
      });
  } else {
    initAndStartRankQr();
  }

    function initAndStartRankQr() {
    rankQr = new Html5Qrcode(targetId);
    const config = {
  　　fps: 10,
  　　qrbox: { width: 200, height: 200 } // ← 固定サイズで表示が安定
　　};
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
      console.log("🎯 順位登録 QR:", decodedText);
      handleRankingScan(decodedText); // ← ここを自分の関数に合わせて変えてOK
    };
    rankQr.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
      .then(() => console.log("✅ 順位登録カメラ起動"))
      .catch(err => {
        console.error("❌ 順位登録カメラ起動エラー:", err);
        displayMessage("❌ 順位登録カメラの起動に失敗しました");
      });
  }
};

window.stopScanCamera = function () {
  if (scanQr) {
    scanQr.stop()
      .then(() => {
        scanQr.clear();
        scanQr = null;
        console.log("🛑 プレイヤー管理カメラ停止");
      })
      .catch(err => {
        console.error("❌ プレイヤーカメラ停止失敗:", err);
      });
  }
};

window.stopRankCamera = function () {
  if (rankQr) {
    rankQr.stop()
      .then(() => {
        rankQr.clear();
        rankQr = null;
        console.log("🛑 順位登録カメラ停止");
      })
      .catch(err => {
        console.error("❌ カメラ停止失敗:", err);
      });
  }
};

window.enterScanMode = function () {
  navigate('scanSection');
  if (rankQr) {
    rankQr.stop()
      .then(() => rankQr.clear())
      .then(() => {
        rankQr = null;
        startScanCamera();
      })
      .catch(err => {
        console.error("❌ 順位登録カメラの停止エラー:", err);
        startScanCamera(); // 強行起動（必要に応じて）
      });
  } else {
    startScanCamera();
  }
};

window.enterRankMode = function () {
  navigate('rankingEntrySection');
  stopScanCamera();    // ← プレイヤー管理カメラ停止
  startRankCamera();   // ← 順位登録カメラ起動
};

function exitRankMode() {
  stopRankCamera();
  navigate('scanSection');
  startScanCamera();
}

function finalizeRanking() {
  const list = document.getElementById("rankingList");
  const rankedIds = Array.from(list.children).map(li => li.dataset.id);
  console.log("順位:", rankedIds);

  if (rankedIds.length < 2) {
    displayMessage("⚠️ 2人以上で順位を登録してください");
    return;
  }

  calculateRate(rankedIds); // ← ここでレート計算を行う

  // 順位履歴を保存（次回用）
  rankedIds.forEach((pid, index) => {
    const p = playerData[pid];
    p.lastRank = index + 1; // 1位が1、2位が2…
  });

  saveToLocalStorage();  // ← 保存（必要なら）
  renderRankingTable();  // ← 再描画（任意）

  displayMessage("✅ 順位を確定しました");
}

window.onload = function () {
  enterScanMode(); // ページ読み込み時はプレイヤー管理モードで開始
};

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
  initCamera();
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
