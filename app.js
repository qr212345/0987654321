  let qrReader;

  const ENDPOINT = "https://script.google.com/macros/s/AKfycbyyNbyyZNFOZWTHpHmoMObnNHwes-26pFAX9nN7NxPKYCYCIDhXDB6_KQSwDtQ-9ZgU/exec";
  const FILE_ID = '1y6caWn6j8SroDRPILJgY8e7uVHLprH2N';
  const SECRET   = "kosen-brain-super-secret";
  const SCAN_COOLDOWN_MS = 1500;
  const POLL_INTERVAL_MS = 20_000;
// データ構造と状態
  let currentSeatId   = null;
  let seatMap         = {};      // { table01: [player01, …] }
  let playerData      = {};      // { playerId: {rate,…} }
  let actionHistory   = [];

  let undoStack = [];
  let redoStack = [];

  let qrActive = false;         // ← グローバル保持して二重起動防止
  let rankingQrReader = null;

  let isRankingMode   =null;
  let rankingSeatId   = null;

  let lastScanTime    = 0;
  let lastScannedText = "";
  let msgTimer        = null;

  let pollTimer = null;
  let douTakuRecords = [];

  let lastScrollTop = 0;
  let scrollTimeout;
  /* ======== ユーティリティ ======== */
const delay = ms => new Promise(res => setTimeout(res, ms));

function displayMessage(msg) {
  const area = document.getElementById("messageArea");
  if (!area) return;
  area.textContent = msg;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => (area.textContent = ""), 3000);
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
    actionHistory.push({ type: "addPlayer", seatId: currentSeatId, playerId: decodedText });
    displayMessage(`✅ ${decodedText} 追加`);
    saveToLocalStorage();
    renderSeats();
  }
}
  /* ======== カメラ起動 ======== */
  function initCamera() {
    // 既にスキャン中なら再起動しない
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
      qrActive = true;  // 起動成功したらフラグを立てる
    }).catch(err => {
      console.error(err);
      displayMessage("❌ カメラの起動に失敗しました");
    });
  }

  /* ======== 座席表示 ======== */
  function renderSeats() {
    const seatList = document.getElementById("seatList");
    seatList.innerHTML = "";

    Object.keys(seatMap).forEach(seatId => {
      const block = document.createElement("div");
      block.className = "seat-block";

      /* --- 見出し --- */
      const title = document.createElement("h3");
      title.textContent = `座席: ${seatId}`;
      const removeSeat = document.createElement("span");
      removeSeat.textContent = "✖";
      removeSeat.className = "remove-button";
      removeSeat.onclick = () => {
        if (confirm(`座席 ${seatId} を削除しますか？`)) {
          actionHistory.push({ type: "removeSeat", seatId, players: seatMap[seatId] });
          delete seatMap[seatId];
          saveToLocalStorage();
          renderSeats();
        }
      };
      title.appendChild(removeSeat);
      block.appendChild(title);

      /* --- プレイヤー --- */
      seatMap[seatId].forEach(pid => {
        const p = playerData[pid];
        const rc = p.bonus ?? 0;
        block.insertAdjacentHTML("beforeend", `
          <div class="player-entry">
            <div>
              <strong>${pid}</strong>
              ${p.title ? `<span class="title-badge title-${p.title}">${p.title}</span>` : ""}
              <span style="margin-left:10px;color:#888;">Rate: ${p.rate}</span>
              <span class="rate-change ${rc>0?"rate-up":rc<0?"rate-down":"rate-zero"}">
                ${rc>0?"↑":rc<0?"↓":"±"}${Math.abs(rc)}
              </span>
            </div>
            <span class="remove-button" onclick="removePlayer('${seatId}','${pid}')">✖</span>
          </div>
        `);
      });

      seatList.appendChild(block);
    });
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

      if (!rankingQrReader) {
        rankingQrReader = new Html5Qrcode("rankingReader");
        rankingQrReader.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 350 },
          decodedText => {
            if (decodedText.startsWith("table")) {
              handleRankingMode(decodedText);
              displayMessage(`✅ 座席 ${decodedText} 読み取り成功`);

              // 読み取り後はカメラを停止
              rankingQrReader.stop()
                .then(() => {
                  rankingQrReader.clear();
                  rankingQrReader = null;
                })
                .catch(err => {
                  console.error("rankingQrReader stop error:", err);
                  rankingQrReader = null;
                });
            } else {
              displayMessage("⚠ 座席コードのみ読み取り可能です");
            }
          }
        ).catch(err => {
          console.error(err);
          displayMessage("❌ カメラの起動に失敗しました（順位登録）");
        });
      }
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
  const playerData = JSON.parse(localStorage.getItem("playerData") || "{}");

  const list = document.getElementById("historyList");
  list.innerHTML = "";

  if (douTakuRecords.length === 0) {
    list.innerHTML = "<p>🔕 履歴がありません</p>";
    return;
  }

  douTakuRecords.forEach(record => {
    const player = playerData[record.playerId] || { name: "不明", seat: "?" };
    const item = document.createElement("div");
    item.className = "history-entry";
    item.innerText = `🔔 ${player.name} さん（座席 ${player.seat}）が ${record.time} に鳴らしました`;
    list.appendChild(item);
  });
}

  // --- ローカル保存・復元 ---
  function saveToLocalStorage() {
  localStorage.setItem("seatMap",    JSON.stringify(seatMap));
  localStorage.setItem("playerData", JSON.stringify(playerData));
  localStorage.setItem("douTakuRecords", JSON.stringify(douTakuRecords));  // 追加
}

// ローカルストレージから読み込み
function loadFromLocalStorage() {
  seatMap    = JSON.parse(localStorage.getItem("seatMap")    || "{}");
  playerData = JSON.parse(localStorage.getItem("playerData") || "{}");
  douTakuRecords = JSON.parse(localStorage.getItem("douTakuRecords") || "[]");  // 追加
}

    /* ---- 順位登録モードに入るときだけカメラをもう 1 本起動 ---- */

/** 座席 QR が読み取られたらドラッグ可能な一覧を生成 */
function handleRankingMode(tableCode) {
  if (!isRankingMode) return;
  rankingSeatId = tableCode;

  const list    = document.getElementById("rankingList");
  list.innerHTML = "";
  (seatMap[tableCode] || []).forEach(pid => {
    const li = document.createElement("li");
    li.textContent     = pid;
    li.dataset.playerId = pid;
    list.appendChild(li);
  });

  makeListDraggable(list);
  displayMessage(`座席 ${tableCode} の順位を並び替えてください`);
}

/** HTML5 Drag & Drop で並び替えられる <ul> を作る */
function makeListDraggable(ul) {
  let dragging = null;

  ul.querySelectorAll("li").forEach(li => {
    li.draggable = true;

    li.ondragstart = () => { dragging = li; li.classList.add("dragging"); };
    li.ondragend   = () => { dragging = null; li.classList.remove("dragging"); };

    li.ondragover  = e => {
      e.preventDefault();
      const tgt = e.target;
      if (tgt && tgt !== dragging && tgt.nodeName === "LI") {
        const r   = tgt.getBoundingClientRect();
        const aft = (e.clientY - r.top) > r.height / 2;
        tgt.parentNode.insertBefore(dragging, aft ? tgt.nextSibling : tgt);
      }
    };
  });
}

/** 「順位決定」ボタン */
function confirmRanking() {
  if (!rankingSeatId) return;

  // li 順で ID を抽出
  const ordered = Array.from(document.querySelectorAll("#rankingList li"))
                    .map(li => li.dataset.playerId);

  ordered.forEach((pid, idx) => {
    if (playerData[pid]) playerData[pid].lastRank = idx + 1;
  });

  calculateRate(ordered);
  displayMessage("✅ 順位を保存しました");
  saveToLocalStorage();
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

//GAS
function loadFromGAS() {
  fetch(ENDPOINT)
    .then(res => res.json())
    .then(json => {
      seatMap        = json.seatMap || {};
      playerData     = json.playerData || {};
      douTakuRecords = json.douTakuRecords || [];
      displayMessage("✅ GASからデータを読み込みました");
      saveToLocalStorage();
      renderSeats();
    })
    .catch(err => {
      console.error(err);
      displayMessage("❌ GASからの読み込みに失敗しました");
    });
}

function saveToGAS() {
  const payload = {
    seatMap,
    playerData,
    douTakuRecords
  };

  fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      secret: SECRET,
      payload
    })
  })
  .then(res => res.text())
  .then(txt => {
    if (txt === "OK") {
      displayMessage("✅ GASに保存しました");
    } else {
      displayMessage("❌ エラー: " + txt);
    }
  })
  .catch(err => {
    console.error(err);
    displayMessage("❌ 通信エラー");
  });
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
}

  // 初期化
document.addEventListener("DOMContentLoaded", () => {
  initCamera();
  loadFromLocalStorage();
  renderSeats();
  bindButtons();
  
  const qrRegionSize = 250;

  const html5QrCode = new Html5Qrcode("reader");

  const config = {
    fps: 10,
    qrbox: {
      width: qrRegionSize,
      height: qrRegionSize,
    },
    aspectRatio: 1.0,
  };

  // ✅ スキャン成功時の処理を定義
  function handleScanSuccess(decodedText, decodedResult) {
    console.log("読み取り成功:", decodedText);
    const messageArea = document.getElementById("messageArea");
    messageArea.textContent = `読み取ったID: ${decodedText}`;

    // あなたの座席登録ロジックに接続可能
    // 例: addPlayerToSeat(decodedText);
  }

  // ✅ スキャンを開始
  html5QrCode.start(
    { facingMode: "environment" },
    config,
    handleScanSuccess
  ).catch((err) => {
    console.error("カメラ起動エラー:", err);
    const messageArea = document.getElementById("messageArea");
    messageArea.textContent = "カメラを起動できませんでした。";
  });
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
