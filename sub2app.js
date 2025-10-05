function App() {
  isRankingMode = true;
  displayMessage("座席QR を読み込んでください（順位登録モード）");
  startRankCamera();
}



document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    document.querySelectorAll(".section").forEach(s => s.style.display = "none");
    const target = document.getElementById("scanSection");
    if(target) {
      target.style.display = "block";
    }
    location.hash = "scanSection";
    isRankingMode = true;
    stopRankCamera().then(startScanCamera);
  }, 500);
});



document.addEventListener("DOMContentLoaded", () => {
  const popBtn = document.getElementById("pop");
  popBtn.addEventListener("click", () => {
    document.querySelectorAll(".section").forEach(s=>s.style.display="none");
    const target=document.getElementById("scanSection");
    if(target) {
      target.style.display="block";
    }
    location.hash="scanSection";
    isRankingMode=false;
    stopRankCamera().then(startScanCamera);
  });
});



// OH-=========================================
//  undoボタンとredoボタンの実装
// OH-=========================================
let undoStack = [];
let redoStack = [];

document.addEventListener("DOMContentLoaded", () => {
  const btnUndo = document.getElementById("btnUndo");
  const btnRedo = document.getElementById("btnRedo");

  btnUndo.addEventListener("click", async () => {
    if (!undoStack.length) {
      displayMessage("元に戻す操作がありません");
      return;
    }
    const last = undoStack.pop();
    redoStack.push(last);
    switch(last.type){
      case "addPlayer":
        seatMap[last.seatId]=seatMap[last.seatId].filter(p=>p!==last.playerId);
        break;
      case "removePlayer":
        seatMap[last.seatId]?.splice(last.index,0,last.playerId);
        break;
    }
    saveToLocalStorage();
    renderSeats();
    displayMessage("↩ 元に戻しました");
  });

  btnRedo.addEventListener("click", async () => {
    if (!redoStack.length) {
      displayMessage("やり直す操作がありません");
      return;
    }
    const last=redoStack.pop();
    undoStack.push(last);
    switch(last.type){
      case "addPlayer":
        seatMap[last.seatId]??=[];
        seatMap[last.seatId].push(last.playerId);
        break;
      case "removePlayer":
        seatMap[last.seatId]=seatMap[last.seatId].filter(p=>p!==last.playerId);
        break;
    }
    saveToLocalStorage();
    renderSeats();
    displayMessage("↪ やり直しました");
  });
});



function saveAction(action) {
  undoStack.push(action);
  redoStack=[];
}





const GAS_URL = "https://script.google.com/macros/s/AKfycby_8v7Gie_f3cdNv8OA5-R3VLVBvPB7rjgAaVuDBbUXKsOMI9AVLyIbaoVpBovGJQ8/exec";
const SECRET_KEY = "your-secret-key";

const SCAN_COOLDOWN_MS = 1500;
const MAX_PLAYERS_PER_SEAT = 6;
const MAX_HISTORY_ITEMS = 100; // 保存する履歴の上限
const pendingResults = {};

let currentSeatId = null;
let seatMap = {};
let playerData = {};
let scanQr = null;
let rankQr = null;
let isScanCameraStarting = false;
let isRankCameraStarting = false;
let isRankingMode = false;
let lastScannedText = null;
let lastScanTime = 0;
let msgTimer = null;
let douTakuRecords = JSON.parse(localStorage.getItem("douTakuRecords") || "[]");
let lastScrollTop = 0;
let historyLog = JSON.parse(localStorage.getItem("historyLog") || "[]");
let historyFilterText = "";  // 空文字で初期化

// =====================
// テーマ設定
// =====================
let themeConfig = {
  seatBox: { backgroundColor: "#f5f5f5", color: "#000000" },
  playerEntry: { backgroundColor: "#d0f0c0", color: "#000000" },
  button: { backgroundColor: "#4CAF50", color: "#ffffff" },
  fontSize: "14px"
};

// =====================
// イベントバインド
// =====================
window.addEventListener("DOMContentLoaded", ()=>{
  const applyThemeBtn = document.getElementById("applyThemeBtn");
  applyThemeBtn.addEventListener("click", ()=>{
    themeConfig.seatBox.backgroundColor = document.getElementById("seatBgColor").value;
    themeConfig.playerEntry.backgroundColor = document.getElementById("playerBgColor").value;
    themeConfig.button.backgroundColor = document.getElementById("buttonBgColor").value;
    themeConfig.button.color = document.getElementById("buttonColor").value;
    themeConfig.fontSize = document.getElementById("fontSizeInput").value + "px";
    document.querySelectorAll(".seat-box").forEach(el=>{
      el.style.backgroundColor = themeConfig.seatBox.backgroundColor;
      el.style.color = themeConfig.seatBox.color;
      el.style.fontSize = themeConfig.fontSize;
    });
    document.querySelectorAll(".player-entry").forEach(el=>{
      el.style.backgroundColor = themeConfig.playerEntry.backgroundColor;
      el.style.color = themeConfig.playerEntry.color;
      el.style.fontSize = themeConfig.fontSize;
    });
    document.querySelectorAll("button").forEach(el=>{
      el.style.backgroundColor = themeConfig.button.backgroundColor;
      el.style.color = themeConfig.button.color;
      el.style.fontSize = themeConfig.fontSize;
    });
  });
});

// =====================
// ユーティリティ
// =====================
const delay = ms => new Promise(res=>setTimeout(res,ms));

function displayMessage(msg){
  const area=document.getElementById("messageArea");
  if(!area) return;
  area.textContent=msg;
  clearTimeout(msgTimer);
  msgTimer=setTimeout(()=>area.textContent="",3000);
}





function notifyAction(message){
  const msg = document.createElement("div");
  msg.className = "notify-popup";
  msg.textContent = message;
  document.body.appendChild(msg);
  setTimeout(()=>msg.remove(),3000);

  const audio = new Audio("https://freesound.org/data/previews/170/170186_2437358-lq.mp3");
  audio.play().catch(()=>{});
}

// =====================
// QRスキャン
// =====================
function handleScanSuccess(decodedText){
  const now = Date.now();
  if(decodedText === lastScannedText && now - lastScanTime < SCAN_COOLDOWN_MS) return;
  lastScannedText = decodedText;
  lastScanTime = now;
  
  const resultEl = document.getElementById("result");
  if(resultEl) resultEl.textContent = `📷 ${decodedText} を読み取りました`;

  if(decodedText.startsWith("table")){
    currentSeatId = decodedText;
    seatMap[currentSeatId] ??= [];
    displayMessage(`✅ 座席セット: ${currentSeatId}`);
    if(isRankingMode) handleRankingScan(decodedText);

  } else if(decodedText.startsWith("player")){
    if(!currentSeatId){
      displayMessage("⚠ 先に座席QRを読み込んでください");
      return;
    }
    if(seatMap[currentSeatId].includes(decodedText)){
      displayMessage("⚠ 既に登録済み");
      return;
    }
    if(seatMap[currentSeatId].length >= MAX_PLAYERS_PER_SEAT){
      displayMessage(`⚠ この座席は${MAX_PLAYERS_PER_SEAT}人まで`);
      return;
    }

    // プレイヤー追加
    seatMap[currentSeatId].push(decodedText);
    playerData[decodedText] ??= { nickname: decodedText };
    saveAction({ type: "addPlayer", seatId: currentSeatId, playerId: decodedText });

    displayMessage(`✅ ${decodedText} 追加`);
    renderSeats();

    // GASに即時送信は行わない
    // sendSeatData(currentSeatId, seatMap[currentSeatId], "webUser");

    // 履歴に記録（ローカル保存は廃止）
    douTakuRecords.push({
      seatId: currentSeatId,
      playerId: decodedText,
      action: "登録",
      time: new Date().toLocaleString()
    });
  }
}

// =====================
// 座席描画
// =====================
function renderSeats() {
  const seatList = document.getElementById("seatList");
  if (!seatList) return;
  seatList.innerHTML = "";

  Object.entries(seatMap).forEach(([seatId, players]) => {
    const seatDiv = document.createElement("div");
    seatDiv.className = "seat-box";

    // 座席名 + 削除ボタン 横並び
    const seatHeader = document.createElement("div");
    seatHeader.className = "seat-header"; // CSSでflexなどを指定

    const seatName = document.createElement("strong");
    seatName.textContent = seatId;
    seatHeader.appendChild(seatName);

    const removeSeatBtn = document.createElement("button");
    removeSeatBtn.textContent = "✖";
    removeSeatBtn.className = "remove-seat-button"; // CSSで見た目統一
    removeSeatBtn.addEventListener("click", () => {
      if(!confirm(`⚠️ 座席「${seatId}」を削除しますか？中のプレイヤーもすべて削除されます`)) return;

      // ローカルデータ削除
      delete seatMap[seatId];

      // ローカル表示更新
      saveToLocalStorage();
      renderSeats();

      // GASに反映
      callGAS({ mode: "deleteSeat", seatId, secret: SECRET_KEY }).then(res => {
        if (res.success) {
          displayMessage(`✅ 座席 ${seatId} 削除完了`);
        } else {
          displayMessage(`❌ 座席削除失敗: ${res.error || "不明"}`);
        }
      }).catch(err => {
        console.error(err);
        displayMessage("❌ 座席削除失敗");
      });
    });
    seatHeader.appendChild(removeSeatBtn);

    seatDiv.appendChild(seatHeader);

    // プレイヤーリスト
    players.forEach(pid => {
      const entryDiv = document.createElement("div");
      entryDiv.className = "player-entry";

      const playerName = document.createElement("strong");
      playerName.textContent = pid;
      entryDiv.appendChild(playerName);

      const removeBtn = document.createElement("span");
      removeBtn.className = "remove-button";
      removeBtn.textContent = "✖";
      removeBtn.addEventListener("click", () => {
        if(!confirm(`⚠️ 座席「${seatId}」から「${pid}」を削除しますか？`)) return;

        const idx=seatMap[seatId]?.indexOf(pid); if(idx===-1) return;
        seatMap[seatId].splice(idx,1);
        saveAction({ type:"removePlayer", seatId, pid, index: idx });
        saveToLocalStorage(); renderSeats();
        sendSeatData(seatId, seatMap[seatId],"webUser");

        logAction(pid, seatId, "削除");
        displayMessage(`❌ ${pid} 削除`);
      });
      entryDiv.appendChild(removeBtn);

      seatDiv.appendChild(entryDiv);
    });

    seatList.appendChild(seatDiv);
  });
}

// =====================
// QR紐づけの自動履歴ログ
// =====================
async function logAction(playerId, seatId, action = "参加", extra = {}) {
  const entry = {
    time: new Date().toLocaleString("ja-JP", { hour12: false }),
    playerId,
    seatId: seatId || null,
    action,
    rank: extra.rank || null
  };

  // マスター配列に追加
  douTakuRecords.push(entry);
  if (douTakuRecords.length > MAX_HISTORY_ITEMS) douTakuRecords.shift();

  // localStorage保存
  localStorage.setItem("douTakuRecords", JSON.stringify(douTakuRecords));

  // 画面描画更新
  renderHistory();

  // GAS送信
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await callGAS({ mode: "addHistory", entry });
      if (!res.success) throw new Error(res.error || "履歴送信失敗");

      const statusContainer = document.getElementById("historyStatus");
      if (statusContainer) statusContainer.textContent = `✅ 送信成功: ${entry.playerId}`;
      return true;

    } catch (e) {
      console.warn(`⚠️ 履歴送信失敗 (${attempt}/3): ${entry.playerId}`, e);
      if (attempt < 3) await new Promise(r => setTimeout(r, 500));
      else {
        const statusContainer = document.getElementById("historyStatus");
        if (statusContainer) statusContainer.textContent = `❌ 送信失敗: ${entry.playerId}`;
        return false;
      }
    }
  }
}

// =====================
// ローカル保存・復元
// =====================
function saveToLocalStorage(){
  localStorage.setItem("seatMap",JSON.stringify(seatMap));
  localStorage.setItem("playerData",JSON.stringify(playerData));
}

// =====================
// 順位登録
// =====================
function handleRankingScan(decodedText) {
  // tableQR以外は警告
  if (!decodedText.startsWith("table")) {
    displayMessage("⚠️ 順位登録は座席QRのみ対応しています");
    return;
  }
  const seatId = decodedText;

  // 座席にプレイヤーがいない場合
  if (!seatMap[seatId]?.length) {
    displayMessage(`⚠️ ${seatId} にはプレイヤーが登録されていません`);
    return;
  }

  // multiRankingArea が存在しない場合は自動生成
  let container = document.getElementById("multiRankingArea");
  if (!container) {
    container = document.createElement("div");
    container.id = "multiRankingArea";
    document.getElementById("rankingSection").appendChild(container);
  }

  // 座席ごとのコンテナ取得or生成
  let seatDiv = document.getElementById(`ranking-${seatId}`);
  if (!seatDiv) {
    seatDiv = document.createElement("div");
    seatDiv.id = `ranking-${seatId}`;
    seatDiv.className = "ranking-seat";

    seatDiv.innerHTML = `
      <h3>${seatId}</h3>
      <ul id="list-${seatId}" class="ranking-list"></ul>
      <button class="finalizeBtn" data-seat="${seatId}">順位確定</button>
    `;

    container.appendChild(seatDiv);

    // 確定ボタンのイベント
    seatDiv.querySelector(".finalizeBtn").addEventListener("click", () => finalizeRanking(seatId));
  }

  // プレイヤーリスト表示（ID + 名前）
  const list = seatDiv.querySelector("ul");
  list.innerHTML = "";
  seatMap[seatId].forEach(player => {
    const li = document.createElement("li");
    li.className = "draggable-item";
    li.draggable = true;
    li.dataset.id = player.id ?? player; // playerがオブジェクトかIDか両方対応
    li.textContent = player.name ? `${player.id} - ${player.name}` : player.id ?? player;
    list.appendChild(li);
  });

  enableDragSort(`list-${seatId}`);
  displayMessage(`✅ ${seatId} のプレイヤーを読み込みました`);
}

function enableDragSort(listId){
  const list = document.getElementById(listId);
  let dragged = null; // リスト単位で閉じる

  list.querySelectorAll(".draggable-item").forEach(item => {
    item.addEventListener("dragstart", () => dragged = item);
    item.addEventListener("dragend", () => dragged = null);
    item.addEventListener("dragover", e => e.preventDefault());
    item.addEventListener("drop", e => {
      e.preventDefault();
      if(dragged && dragged !== item){
        const items = Array.from(list.children);
        const di = items.indexOf(dragged), ii = items.indexOf(item);
        if(di < ii) list.insertBefore(dragged, item.nextSibling);
        else list.insertBefore(dragged, item);
      }
    });
  });
}

async function finalizeRanking(seatId) {
  if (!confirm("⚠️ この順位を確定しますか？")) return;

  const list = document.getElementById(`list-${seatId}`);
  if (!list) return;

  // ドラッグ順序から playerId を抽出
  const rankedIds = Array.from(list.children).map(li => li.dataset.id);
  if (rankedIds.length < 4) {
    displayMessage("⚠️ 4人以上必要です");
    return;
  }

  // { playerId, rank } 形式に変換
  const entries = rankedIds.map((playerId, index) => ({
    playerId,
    rank: index + 1
  }));

  // pendingResults に座席IDと一緒に格納
  pendingResults[seatId] = {
    seatId,
    entries
  };

  // UIリセット（必要に応じて seatMap もクリア）
  if (seatMap[seatId]) {
    seatMap[seatId] = [];
    renderSeats();
  }

  // カメラ停止（座席単位）
  await stopRankCamera();

  displayMessage(`✅ ${seatId} の順位を保留しました。まとめて送信可能です`);
}

// =====================
// GAS通信（プリフライト回避版）
// =====================
async function callGAS(payload = {}, options = {}) {
  // GAS で受信可能な形式に secret を必ず付与
  payload.secret = SECRET_KEY;

  const maxRetries = options.retries ?? 3;  // 最大リトライ回数
  const timeoutMs  = options.timeout ?? 15000; // タイムアウト(ms)
  let attempt = 0;

  while (attempt < maxRetries) {
    // タイムアウト制御用の AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // プリフライト回避のため text/plain で送信
      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      // タイマークリア
      clearTimeout(timer);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // JSON レスポンスを返す
      return await res.json();

    } catch (err) {
      attempt++;
      console.warn("GAS通信リトライ", attempt, err);

      // 1秒待機して再試行
      await new Promise(r => setTimeout(r, 1000));

      if (attempt >= maxRetries) throw err;
    }
  }
}

// =====================
// 保存
// =====================
async function saveToGAS(seatMapData, playerDataObj) {
  try {
    const res = await callGAS({ mode: "saveData", seatMap: seatMapData, playerData: playerDataObj });
    if (!res.success) throw new Error(res.error || "保存失敗");
    displayMessage("✅ データ保存成功");
  } catch (err) {
    console.error("GAS保存失敗", err);
    displayMessage("❌ データ保存失敗");
  }
}

// =====================
// 読み込み
// =====================
async function loadFromGAS() {
  try {
    const res = await callGAS({ mode: "loadData" });
    seatMap = res.seatMap || {};
    playerData = res.playerData || {};
    renderSeats();
    displayMessage("✅ データ読み込み成功");
  } catch (err) {
    console.error("GAS読み込み失敗", err);
    displayMessage("❌ データ読み込み失敗");
  }
}

// =====================
// 座席更新
// =====================
async function sendSeatData(tableID, playerIds, operator = "webUser") {
  try {
    await syncSeatData(seatMap);

    const filteredPlayers = playerIds.filter(pid => {
      for (const seat in seatMap) {
        if (seatMap[seat]?.includes(pid)) return false;
      }
      return true;
    });

    if (filteredPlayers.length === 0) {
      displayMessage("⚠ このプレイヤーはすでに登録されています");
      return;
    }

    seatMap[tableID] = filteredPlayers;
    const res = await callGAS({ mode: "updatePlayers", tableID, players: filteredPlayers, operator });

    if (!res.success) throw new Error(res.error || "座席更新失敗");

    renderSeats();
    displayMessage(`✅ 座席 ${tableID} 更新成功`);
    playNotification();

  } catch (err) {
    console.error("座席送信失敗", err);
    displayMessage("❌ 座席送信失敗");
  }
}

// =====================
// 履歴取得（ポーリング）
// =====================
async function pollHistory() {
  try {
    const res = await callGAS({ mode: "loadHistory" });
    douTakuRecords = Array.isArray(res.history) ? res.history : [];
    renderHistory();
  } catch (e) {
    console.warn("履歴取得失敗", e);
  }
}
setInterval(pollHistory, 10000);


// =====================
// 通常スキャンカメラ起動
// =====================
async function startScanCamera() {
  const readerElem = document.getElementById("reader");
  if (!readerElem) {
    console.warn("startScanCamera: reader要素が存在しません");
    return;
  }
  if (isScanCameraStarting || scanQr) return; // 二重起動防止

  isScanCameraStarting = true;

  try {
    scanQr = new Html5Qrcode("reader");
    await scanQr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 350 },
      handleScanSuccess
    );
    console.log("Scanカメラ起動成功");
    displayMessage("✅ Scanカメラ起動");
  } catch (e) {
    console.error("Scanカメラ起動失敗", e);
    displayMessage("❌ Scanカメラ起動失敗");
    scanQr = null;
  } finally {
    isScanCameraStarting = false;
  }
}

// =====================
// 順位登録カメラ起動
// =====================
async function startRankCamera() {
  const rankElem = document.getElementById("rankingReader");
  if (!rankElem) {
    console.warn("startRankCamera: rankingReader要素が存在しません");
    return;
  }
  if (isRankCameraStarting || rankQr) return; // 二重起動防止

  isRankCameraStarting = true;

  try {
    rankQr = new Html5Qrcode("rankingReader");
    await rankQr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 200 },
      handleRankingScan
    );
    console.log("Rankカメラ起動成功");
    displayMessage("✅ Rankカメラ起動");
  } catch (e) {
    console.error("Rankカメラ起動失敗", e);
    displayMessage("❌ Rankカメラ起動失敗");
    rankQr = null;
  } finally {
    isRankCameraStarting = false;
  }
}

// =====================
// 通常スキャンカメラ停止
// =====================
async function stopScanCamera() {
  if (!scanQr) return;

  try {
    await scanQr.stop();

    // clear前に要素が存在するか確認
    const readerElem = document.getElementById("reader");
    if (readerElem && readerElem.parentNode) {
      await scanQr.clear();
    }

    console.log("Scanカメラ停止完了");
    displayMessage("🛑 Scanカメラ停止");
  } catch (e) {
    console.warn("stopScanCameraエラー:", e);
    displayMessage("⚠️ Scanカメラ停止エラー");
  } finally {
    scanQr = null;
    isScanCameraStarting = false;
  }
}

// =====================
// 順位登録カメラ停止
// =====================
async function stopRankCamera() {
  if (!rankQr) return; // カメラ未起動なら即リターン

  try {
    // 1) カメラ停止
    await rankQr.stop();

    // 2) DOM要素が存在する場合のみ処理
    const rankElem = document.getElementById("rankingReader");
    if (rankElem) {
      // clear() は内部で removeChild を行うため try-catch 保護
      if (typeof rankQr.clear === "function") {
        try {
          await rankQr.clear();
        } catch (clearErr) {
          console.warn("Rankカメラ clear() 失敗:", clearErr);
        }
      }
      // 念のため DOMも手動でクリア（UI残り防止）
      rankElem.innerHTML = "";
    }

    console.log("Rankカメラ停止完了");
    displayMessage("🛑 Rankカメラ停止");
  } catch (e) {
    console.warn("stopRankCameraエラー:", e);
    displayMessage("⚠️ Rankカメラ停止エラー");
  } finally {
    // 3) 状態リセット
    rankQr = null;
    isRankCameraStarting = false;
  }
}

function exportRankingHistoryCSV(){
  if(douTakuRecords.length === 0){
    displayMessage("⚠️ 履歴がありません");
    return;
  }

  const header = ["playerId","rank","action","seatId","time"];
  const rows = douTakuRecords.map(r => [
    r.playerId, r.rank, r.action, r.seatId ?? "", r.time
  ]);

  const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], {type: "text/csv"});
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `ranking_history_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  displayMessage("✅ 履歴CSVを出力しました");
}

document.addEventListener("DOMContentLoaded", async () => {
  try { 
    await loadFromGAS(); 
  } catch (e) { 
    console.warn("GASロード失敗,ローカル使用", e); 
  }
  document.getElementById("confirmRankingBtn")?.addEventListener("click", finalizeRanking);
  document.getElementById("saveToGASBtn")?.addEventListener("click", () => saveToGAS(seatMap, playerData));
  document.getElementById("loadFromGASBtn")?.addEventListener("click", loadFromGAS);
  document.getElementById("exportHistoryBtn")?.addEventListener("click", exportRankingHistoryCSV);
  renderSeats();
  startScanCamera();
})
