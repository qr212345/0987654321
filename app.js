let qrReader;

// =====================
// 統一GAS URL
// =====================
const GAS_URL = "https://script.google.com/macros/s/AKfycbzYnGPFf0h8aMrfANT4X5oOSDDspjfe12GEZnpWiB0u6XJYCNnIf5g9xvoYqj4pQ9M/exec";
const SECRET_KEY = "your-secret-key";

const SCAN_COOLDOWN_MS = 1500;
const MAX_PLAYERS_PER_SEAT = 6;

// =====================
// データ構造と状態
// =====================
let currentSeatId = null;
let seatMap = {};
let playerData = {};
let undoStack = [];
let redoStack = [];
let qrActive = false;
let scanQr = null;
let rankQr = null;
let isScanCameraStarting = false;
let isRankCameraStarting = false;
let isRankingMode = false;
let currentRankingSeatId = null;
let lastScannedText = null;
let lastScanTime = 0;
let msgTimer = null;
let pollTimer = null;
let douTakuRecords = JSON.parse(localStorage.getItem("douTakuRecords") || "[]");
let sidebar = document.getElementById("sidebar");
let lastScrollTop = 0;
let scrollTimeout;
let passwordValidated = false;
let historyLog = JSON.parse(localStorage.getItem("historyLog") || "[]");
let timerInterval = null;
let remaining = 0;
let paused = false;
let countingUp = false;

// =====================
// テーマ設定
// =====================
// HEXを6桁に統一
// =====================
// テーマ設定
// =====================

// HEXを6桁に統一
function expandHexColor(hex) {
  if(/^#([0-9a-fA-F]{3})$/.test(hex)) {
    return "#" + hex[1]+hex[1] + hex[2]+hex[2] + hex[3]+hex[3];
  }
  return hex;
}

let themeConfig = {
  seatBox: { backgroundColor: "#f5f5f5", color: "#000000" },
  playerEntry: { backgroundColor: "#d0f0c0", color: "#000000" },
  button: { backgroundColor: "#4CAF50", color: "#ffffff" },
  fontSize: "14px"
};

// テーマ適用関数
function applyTheme() {
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
}

// =====================
// イベントバインド
// =====================
window.addEventListener("DOMContentLoaded", ()=>{
  const themeSection = document.getElementById("themeSection");
  const openThemeBtn = document.getElementById("openThemeBtn");
  const closeThemeBtn = document.getElementById("closeThemeBtn");
  const applyThemeBtn = document.getElementById("applyThemeBtn");

  // 開閉ボタン
  openThemeBtn.addEventListener("click", ()=>{
    themeSection.style.display = themeSection.style.display === "none" ? "block" : "none";
  });
  closeThemeBtn.addEventListener("click", ()=>{
    themeSection.style.display = "none";
  });

  // 適用ボタン
  applyThemeBtn.addEventListener("click", ()=>{
    themeConfig.seatBox.backgroundColor = document.getElementById("seatBgColor").value;
    themeConfig.playerEntry.backgroundColor = document.getElementById("playerBgColor").value;
    themeConfig.button.backgroundColor = document.getElementById("buttonBgColor").value;
    themeConfig.button.color = document.getElementById("buttonColor").value;
    themeConfig.fontSize = document.getElementById("fontSizeInput").value + "px";
    applyTheme();
  });

  applyTheme(); // 初期テーマ適用
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

async function requireAuth(callback){
  if(passwordValidated) return callback();
  const pw=prompt("パスワードを入力してください");
  if(pw==="supersecret"){ passwordValidated=true; callback(); }
  else alert("認証失敗");
}

function navigate(targetId){
  document.querySelectorAll('.section').forEach(s=>s.style.display='none');
  const target=document.getElementById(targetId);
  if(target) target.style.display='block';
  location.hash=targetId;

  switch(targetId){
    case 'historySection': loadDouTakuHistory(); break;
    case 'rankingSection':
      requireAuth(()=>{
        isRankingMode=true;
        currentRankingSeatId=null;
        document.getElementById("rankingList").innerHTML="";
        displayMessage("座席QR を読み込んでください（順位登録モード）");
        startRankCamera();
      });
      break;
    case 'scanSection':
      isRankingMode=false;
      stopRankCamera().then(startScanCamera);
      break;
  }
}

async function navigateAsync(sectionId){ return new Promise(res=>{ navigate(sectionId); setTimeout(res,300); }); }

function notifyAction(message){
  const msg = document.createElement("div");
  msg.className = "notify-popup";
  msg.textContent = message;
  document.body.appendChild(msg);
  setTimeout(()=>msg.remove(),3000);

  const audio = new Audio("https://freesound.org/data/previews/170/170186_2437358-lq.mp3");
  audio.play().catch(()=>{});
}

function onQrScanSuccess(data){ notifyAction(`この座席で「${data}」を登録しました！`); }

// =====================
// QRスキャン
// =====================
function handleScanSuccess(decodedText){
  const now=Date.now();
  if(decodedText===lastScannedText && now-lastScanTime<SCAN_COOLDOWN_MS) return;
  lastScannedText=decodedText; lastScanTime=now;

  const resultEl=document.getElementById("result");
  if(resultEl) resultEl.textContent=`📷 ${decodedText} を読み取りました`;

  if(decodedText.startsWith("table")){
    currentSeatId=decodedText;
    seatMap[currentSeatId]??=[];
    displayMessage(`✅ 座席セット: ${currentSeatId}`);
    if(isRankingMode) handleRankingScan(decodedText);
  } else if(decodedText.startsWith("player")){
    if(!currentSeatId){ displayMessage("⚠ 先に座席QRを読み込んでください"); return; }
    if(!passwordValidated){ displayMessage("⚠ 管理者モードでのみ操作可能です"); return; }
    if(seatMap[currentSeatId].includes(decodedText)){ displayMessage("⚠ 既に登録済み"); return; }
    if(seatMap[currentSeatId].length>=MAX_PLAYERS_PER_SEAT){ displayMessage(`⚠ この座席は${MAX_PLAYERS_PER_SEAT}人まで`); return; }

    seatMap[currentSeatId].push(decodedText);
    playerData[decodedText]??={nickname:decodedText};
    saveAction({type:"addPlayer",seatId:currentSeatId,playerId:decodedText});
    displayMessage(`✅ ${decodedText} 追加`);
    saveToLocalStorage();
    renderSeats();
    sendSeatData(currentSeatId,seatMap[currentSeatId],'webUser');
    douTakuRecords.push({seatId: currentSeatId, playerId: decodedText, action: "登録", time: new Date().toLocaleString()});
    localStorage.setItem("douTakuRecords", JSON.stringify(douTakuRecords));
  }
}

// =====================
// QR紐づけの自動履歴ログ
// =====================
function logAction(playerId, seatId, action="参加", extra={}) {
  const entry = {
    time: new Date().toLocaleString("ja-JP", { hour12:false }),
    playerId,
    seatId: seatId || null,
    action,
    rank: extra.rank || null
  };
  historyLog.push(entry);
  localStorage.setItem("historyLog", JSON.stringify(historyLog));
  renderHistory();
  sendHistoryEntry(entry).catch(e => console.warn(`履歴送信失敗: ${playerId}`, e));
}

// =====================
// 座席描画
// =====================
function renderSeats(){
  const seatList=document.getElementById("seatList");
  if(!seatList) return;
  seatList.innerHTML="";

  Object.entries(seatMap).forEach(([seatId,players])=>{
    const seatDiv=document.createElement("div");
    seatDiv.className="seat-box";
    seatDiv.innerHTML=`<strong>${seatId}</strong>`;
    seatDiv.style.backgroundColor=themeConfig.seatBox.backgroundColor;
    seatDiv.style.color=themeConfig.seatBox.color;
    seatDiv.style.fontSize=themeConfig.fontSize;

    players.forEach(pid=>{
      const entryDiv=document.createElement("div");
      entryDiv.className="player-entry";
      entryDiv.innerHTML=`<strong>${pid}</strong>`;
      entryDiv.style.backgroundColor=themeConfig.playerEntry.backgroundColor;
      entryDiv.style.color=themeConfig.playerEntry.color;
      entryDiv.style.fontSize=themeConfig.fontSize;

      const removeBtn=document.createElement("span");
      removeBtn.className="remove-button";
      removeBtn.textContent="✖";
      removeBtn.addEventListener("click",()=>removePlayer(seatId,pid));
      entryDiv.appendChild(removeBtn);
      seatDiv.appendChild(entryDiv);
    });

    seatList.appendChild(seatDiv);
  });
}

// =====================
// プレイヤー追加/削除
// =====================
function addPlayerToSeat(seatId, playerId){
  if(!passwordValidated){ displayMessage("⚠ 管理者モードでのみ操作可能です"); return; }
  if(!seatMap[seatId]) seatMap[seatId]=[];
  if(seatMap[seatId].includes(playerId)){ displayMessage("⚠ 既に登録済み"); return; }
  if(seatMap[seatId].length>=MAX_PLAYERS_PER_SEAT){ displayMessage(`⚠ この座席は${MAX_PLAYERS_PER_SEAT}人まで`); return; }

  seatMap[seatId].push(playerId);
  playerData[playerId] ??= { nickname: playerId };
  saveAction({ type:"addPlayer", seatId, playerId });
  saveToLocalStorage(); renderSeats();
  sendSeatData(seatId, seatMap[seatId],'webUser');

  logAction(playerId, seatId, "登録");
  displayMessage(`✅ ${playerId} 追加`);
}

function removePlayer(seatId, playerId){
  if(!passwordValidated){ displayMessage("⚠ 管理者モードでのみ操作可能です"); return; }
  if(!confirm(`⚠️ 座席「${seatId}」から「${playerId}」を削除しますか？`)) return;

  const idx=seatMap[seatId]?.indexOf(playerId); if(idx===-1) return;
  seatMap[seatId].splice(idx,1);
  saveAction({ type:"removePlayer", seatId, playerId, index: idx });
  saveToLocalStorage(); renderSeats();
  sendSeatData(seatId, seatMap[seatId],'webUser');

  logAction(playerId, seatId, "削除");
  displayMessage(`❌ ${playerId} 削除`);
}

// =====================
// Undo / Redo
// =====================
function saveAction(action){ undoStack.push(action); redoStack=[]; }

function undoAction(){
  if(!undoStack.length){ displayMessage("元に戻す操作がありません"); return; }
  const last=undoStack.pop();
  redoStack.push(last);
  switch(last.type){
    case "addPlayer": seatMap[last.seatId]=seatMap[last.seatId].filter(p=>p!==last.playerId); break;
    case "removePlayer": seatMap[last.seatId]?.splice(last.index,0,last.playerId); break;
  }
  saveToLocalStorage(); renderSeats(); displayMessage("↩ 元に戻しました");
}

function redoAction(){
  if(!redoStack.length){ displayMessage("やり直す操作がありません"); return; }
  const last=redoStack.pop();
  undoStack.push(last);
  switch(last.type){
    case "addPlayer": seatMap[last.seatId]??=[]; seatMap[last.seatId].push(last.playerId); break;
    case "removePlayer": seatMap[last.seatId]=seatMap[last.seatId].filter(p=>p!==last.playerId); break;
  }
  saveToLocalStorage(); renderSeats(); displayMessage("↪ やり直しました");
}

// =====================
// 履歴描画
// =====================
function loadDouTakuHistory(){
  const records=JSON.parse(localStorage.getItem("douTakuRecords")||"[]");
  const list=document.getElementById("historyList");
  if(!list) return; list.innerHTML="";
  if(!records.length){ list.innerHTML="<p>🔕 履歴がありません</p>"; return; }
  records.forEach(r=>{
    const div=document.createElement("div");
    div.className="history-entry";
    div.textContent=`🔔 ${r.playerId} さん（座席 ${r.seatId}）が ${r.time} に ${r.action}`;
    list.appendChild(div);
  });
}

async function sendHistoryEntry(entry, retries = 3, delayMs = 500) {
  const statusContainer = document.getElementById("historyStatus");
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (statusContainer) {
        statusContainer.textContent = `送信中: ${entry.playerId} (${attempt}/${retries})`;
      }

      await callGAS({ mode: "addHistory", entry });

      if (statusContainer) {
        statusContainer.textContent = `✅ 送信成功: ${entry.playerId}`;
      }
      console.log(`✅ 履歴送信成功: ${entry.playerId}`);
      return true;

    } catch (e) {
      console.warn(`⚠️ 履歴送信失敗 (${attempt}/${retries}): ${entry.playerId}`, e);

      if (attempt < retries) {
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        if (statusContainer) {
          statusContainer.textContent = `❌ 送信失敗: ${entry.playerId}`;
        }
        console.error(`❌ 履歴送信完全に失敗: ${entry.playerId}`);
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

function loadFromLocalStorage(){
  seatMap=JSON.parse(localStorage.getItem("seatMap")||"{}");
  playerData=JSON.parse(localStorage.getItem("playerData")||"{}");
  renderSeats();
}

// =====================
// 順位登録
// =====================
function handleRankingScan(seatId){
  currentRankingSeatId=seatId;
  if(!seatMap[seatId]?.length){ displayMessage("⚠️ この座席にはプレイヤーが登録されていません"); return; }
  const list=document.getElementById("rankingList");
  list.innerHTML="";
  seatMap[seatId].forEach(pid=>{
    const li=document.createElement("li");
    li.className="draggable-item";
    li.draggable=true; li.dataset.id=pid; li.textContent=pid;
    list.appendChild(li);
  });
  enableDragSort("rankingList");
  displayMessage(`✅ 座席 ${seatId} のプレイヤーを読み込みました`);
}

function enableDragSort(listId){
  const list=document.getElementById(listId);
  let dragged;
  list.querySelectorAll(".draggable-item").forEach(item=>{
    item.addEventListener("dragstart",()=>dragged=item);
    item.addEventListener("dragend",()=>dragged=null);
    item.addEventListener("dragover",e=>e.preventDefault());
    item.addEventListener("drop",e=>{
      e.preventDefault();
      if(dragged && dragged!==item){
        const items=Array.from(list.children);
        const di=items.indexOf(dragged), ii=items.indexOf(item);
        if(di<ii) list.insertBefore(dragged,item.nextSibling);
        else list.insertBefore(dragged,item);
      }
    });
  });
}

async function finalizeRanking(){
  if(!confirm("⚠️ この順位を確定しますか？")) return;
  const list = document.getElementById("rankingList");
  if(!list) return;

  const rankedIds = Array.from(list.children).map(li=>li.dataset.id);
  if(rankedIds.length<2){ displayMessage("⚠️ 2人以上必要です"); return; }

  const entries = rankedIds.map((playerId, index)=>({ playerId, rank:index+1 }));
  if(!await postRankingUpdate(entries)){ displayMessage("❌ 順位送信失敗"); return; }

  rankedIds.forEach((playerId,index)=> logAction(playerId,currentRankingSeatId,"順位確定",{rank:index+1}));

  if(currentRankingSeatId && seatMap[currentRankingSeatId]){
    seatMap[currentRankingSeatId]=[];
    currentRankingSeatId=null;
    renderSeats(); await stopRankCamera();
  }

  displayMessage("🏆 順位確定＆履歴送信完了");
}

// =====================
// GAS通信（CORS対策済み、プロキシ不要）
// =====================
async function callGAS(payload = {}, options = {}) {
  payload.secret = SECRET_KEY;  // すべてのリクエストに必須
  const maxRetries = options.retries ?? 3;
  const timeoutMs = options.timeout ?? 8000;
  let attempt = 0;

  while (attempt < maxRetries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();

    } catch (e) {
      attempt++;
      console.warn("GAS通信リトライ", attempt, e);
      await new Promise(r => setTimeout(r, 1000));
      if (attempt >= maxRetries) throw e;
    }
  }
}

// =====================
// データ同期
// =====================
async function syncSeatData(localSeatMap) {
  try {
    const res = await callGAS({ mode: "loadData" });
    const remoteSeatMap = res.seatMap || {};
    const mergedSeatMap = { ...remoteSeatMap };

    for (const seatId in localSeatMap) {
      if (!mergedSeatMap[seatId] || mergedSeatMap[seatId].length === 0) {
        mergedSeatMap[seatId] = localSeatMap[seatId];
      } else {
        localSeatMap[seatId] = mergedSeatMap[seatId];
      }
    }

    seatMap = mergedSeatMap;
    renderSeats();
    displayMessage("✅ データ同期完了");
    return mergedSeatMap;

  } catch (err) {
    console.error("データ同期失敗", err);
    displayMessage("❌ データ同期失敗");
    return null;
  }
}

// =====================
// 保存 / 読み込み
// =====================
async function saveToGAS(seatMapData, playerDataObj) {
  try {
    const res = await callGAS({ mode: "saveData", seatMap: seatMapData, playerData: playerDataObj });
    if (!res.success) throw new Error(res.error || "保存失敗");
    displayMessage("✅ データ保存成功");
  } catch (err) {
    displayMessage("❌ データ保存失敗");
    console.error(err);
  }
}

async function loadFromGAS() {
  try {
    const res = await callGAS({ mode: "loadData" });
    seatMap = res.seatMap || {};
    playerData = res.playerData || {};
    renderSeats();
    displayMessage("✅ データ読み込み成功");
  } catch (err) {
    displayMessage("❌ データ読み込み失敗");
    console.error(err);
  }
}

// =====================
// 座席更新
// =====================
async function sendSeatData(tableID, playerIds, operator = 'webUser') {
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
    console.error('座席送信失敗', err);
    displayMessage("❌ 座席送信失敗");
  }
}

// =====================
// 履歴送信
// =====================
async function sendHistoryEntry(entry, retries = 3, delayMs = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await callGAS({ mode: "addHistory", entry });
      if (!res.success) throw new Error(res.error || "履歴送信失敗");

      const statusContainer = document.getElementById("historyStatus");
      if (statusContainer) statusContainer.textContent = `✅ 送信成功: ${entry.playerId}`;
      return true;

    } catch (e) {
      console.warn(`⚠️ 履歴送信失敗 (${attempt}/${retries}): ${entry.playerId}`, e);
      if (attempt < retries) await new Promise(r => setTimeout(r, delayMs));
      else {
        const statusContainer = document.getElementById("historyStatus");
        if (statusContainer) statusContainer.textContent = `❌ 送信失敗: ${entry.playerId}`;
        return false;
      }
    }
  }
}

// =====================
// 順位登録
// =====================
async function postRankingUpdate(entries) {
  try {
    const res = await callGAS({ mode: "updateRanking", rankings: entries });
    if (!res.success) throw new Error(res.error || "順位送信失敗");

    displayMessage("✅ 順位送信成功");
    return true;

  } catch (err) {
    console.error('順位送信失敗', err);
    displayMessage("❌ 順位送信失敗");
    return false;
  }
}

// =====================
// リアルタイム履歴取得
// =====================
async function pollHistory() {
  try {
    const res = await callGAS({ mode: "loadHistory" });
    if (res.history) {
      historyLog = res.history;
      localStorage.setItem("historyLog", JSON.stringify(historyLog));
      renderHistory();
    }
  } catch (e) {
    console.warn("履歴取得失敗", e);
  }
}

setInterval(pollHistory, 10000);  // 10秒ごと

// =====================
// 通知（ベル）
// =====================
function playNotification(){
  const audio = new Audio("https://freesound.org/data/previews/170/170186_2437358-lq.mp3"); // 任意の通知音
  audio.play().catch(()=>{});
}

// =====================
// 削除確認ダイアログ
// =====================
function confirmAction(message){
  return confirm(`⚠️ ${message}`);
}

// =====================
// カメラ制御
// =====================
function startScanCamera(){
  if(isScanCameraStarting||!document.getElementById("reader")) return;
  isScanCameraStarting=true;
  scanQr=new Html5Qrcode("reader");
  scanQr.start({facingMode:"environment"}, {fps:10, qrbox:350}, handleScanSuccess)
    .catch(e=>displayMessage("❌ カメラ起動失敗"))
    .finally(()=>isScanCameraStarting=false);
}

function startRankCamera(){
  if(isRankCameraStarting||!document.getElementById("rankingReader")) return;
  isRankCameraStarting=true;
  rankQr=new Html5Qrcode("rankingReader");
  rankQr.start({facingMode:"environment"}, {fps:10, qrbox:200}, decodedText=>handleRankingScan(decodedText))
    .catch(e=>displayMessage("❌ 順位登録カメラ起動失敗"))
    .finally(()=>isRankCameraStarting=false);
}

async function stopScanCamera(){ if(scanQr){ await scanQr.stop(); await scanQr.clear(); scanQr=null; } }
async function stopRankCamera(){ if(rankQr){ await rankQr.stop(); await rankQr.clear(); rankQr=null; } }

// =====================
// CSVエクスポート
// =====================
function toCSV(data, headers){
  const rows=[headers.join(",")];
  data.forEach(row=>{
    rows.push(headers.map(h=>{
      let v=row[h]??"";
      if(typeof v==="string" && v.includes(",")) v=`"${v.replace(/"/g,'""')}"`;
      return v;
    }).join(","));
  });
  return rows.join("\n");
}

function downloadCSV(csvText, filename){
  const blob=new Blob([csvText], {type:"text/csv;charset=utf-8;"}), url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

window.exportPlayerCSV = ()=>{
  const players=[];
  Object.entries(seatMap).forEach(([seatID,playerList])=>playerList.forEach(playerID=>players.push({playerID,seatID})));
  if(players.length===0){ displayMessage("⚠ エクスポートデータなし"); return; }
  downloadCSV(toCSV(players,["playerID","seatID"]),"players.csv");
};

window.exportSeatCSV = ()=>{
  const seats=[];
  Object.entries(seatMap).forEach(([seatID,playerList])=>seats.push({seatID,players:playerList.join("|")}));
  if(seats.length===0){ displayMessage("⚠ エクスポートデータなし"); return; }
  downloadCSV(toCSV(seats,["seatID","players"]),"seats.csv");
};

document.getElementById("closeHelpBtn").addEventListener("click", ()=>{
  document.getElementById("helpSection").style.display = "none";
});

function renderHistory(){
  const container=document.getElementById("historyList"); if(!container) return;
  container.innerHTML="";
  historyLog.slice().reverse().forEach(e=>{
    const div=document.createElement("div");
    div.className="history-entry";
    div.textContent=`[${e.time}] ${e.playerId} → ${e.seatId||"N/A"} : ${e.action}`
      + (e.rank?`（順位: ${e.rank}位）`:"");
    container.appendChild(div);
  });
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

function exportHistoryCSV(){
  if(historyLog.length===0){ displayMessage("⚠️ 履歴なし"); return; }
  const header=["time","playerId","seatId","action","rank"];
  const rows = historyLog.map(r=>[r.time,r.playerId,r.seatId??"",r.action,r.rank??""]);
  const csvContent=[header,...rows].map(e=>e.join(",")).join("\n");
  const blob=new Blob([csvContent],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`history_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  displayMessage("✅ 履歴CSV出力完了");
}

// =====================
// 初期化
// =====================
function bindButtons() {
  document.getElementById("undoBtn")?.addEventListener("click", undoAction);
  document.getElementById("redoBtn")?.addEventListener("click", redoAction);
  document.getElementById("exportPlayerBtn")?.addEventListener("click", exportPlayerCSV);
  document.getElementById("exportSeatBtn")?.addEventListener("click", exportSeatCSV);
  document.getElementById("confirmRankingBtn")?.addEventListener("click", finalizeRanking);
  document.getElementById("saveToGASBtn")?.addEventListener("click", () => requireAuth(() => saveToGAS(seatMap, playerData)));
  document.getElementById("loadFromGASBtn")?.addEventListener("click", () => requireAuth(loadFromGAS));
  document.getElementById("exportHistoryBtn")?.addEventListener("click", exportRankingHistoryCSV);
};
  document.addEventListener("DOMContentLoaded", async () => {
    try { 
      await loadFromGAS(); 
    }   catch (e) { 
    console.warn("GASロード失敗,ローカル使用", e); 
  }
  loadFromLocalStorage();
  renderSeats();
  applyTheme();
  bindButtons();
  startScanCamera();
  applyTheme();
  
  // スクロールでサイドバー自動開閉
  window.addEventListener("scroll", () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    const st = window.pageYOffset || document.documentElement.scrollTop;
    if (st > lastScrollTop) sidebar?.classList.add("closed"); 
    else sidebar?.classList.remove("closed");
    lastScrollTop = st <= 0 ? 0 : st;
    scrollTimeout = setTimeout(() => sidebar?.classList.remove("closed"), 1500);
   
}); // ここでDOMContentLoadedの括弧を閉じる
})
// window に関数を登録
Object.assign(window, {
  navigate,
  undoAction,
  redoAction,
  removePlayer,
  exportPlayerCSV,
  exportSeatCSV,
}); 
