let qrReader;

// =====================
// 統一GAS URL
// =====================
const GAS_URL = "https://script.google.com/macros/s/統合GASのURL/exec";
const SECRET  = "kosen-brain-super-secret";

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
let douTakuRecords = [];

let sidebar = document.getElementById("sidebar");
let lastScrollTop = 0;
let scrollTimeout;

let passwordValidated = false;

// =====================
// テーマ設定
// =====================
let themeConfig = {
  seatBox: { backgroundColor: "#f5f5f5", color: "#000" },
  playerEntry: { backgroundColor: "#d0f0c0", color: "#000" },
  button: { backgroundColor: "#4CAF50", color: "#fff" },
  fontSize: "14px"
};

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

function createThemePanel() {
  // 既に存在する場合は削除
  const existing = document.getElementById("themePanel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "themePanel";
  Object.assign(panel.style,{
    position:"fixed",
    top:"10px",
    right:"10px",
    width:"250px",
    backgroundColor:"#fff",
    border:"1px solid #ccc",
    padding:"10px",
    borderRadius:"8px",
    boxShadow:"0 2px 6px rgba(0,0,0,0.2)",
    zIndex:1000,
    display:"none" // 初期は非表示
  });

  panel.innerHTML=`
    <h4 style="margin-top:0;">
      テーマ編集
      <button id="closeThemeBtn" style="float:right; background:#f44336; color:#fff; border:none; border-radius:4px; padding:2px 6px; cursor:pointer;">×</button>
    </h4>
    <label>座席背景: <input type="color" id="seatBgColor" value="${themeConfig.seatBox.backgroundColor}"></label><br>
    <label>プレイヤー背景: <input type="color" id="playerBgColor" value="${themeConfig.playerEntry.backgroundColor}"></label><br>
    <label>ボタン背景: <input type="color" id="buttonBgColor" value="${themeConfig.button.backgroundColor}"></label><br>
    <label>ボタン文字色: <input type="color" id="buttonColor" value="${themeConfig.button.color}"></label><br>
    <label>フォントサイズ: <input type="number" id="fontSizeInput" value="${parseInt(themeConfig.fontSize)}" style="width:60px">px</label><br>
    <button id="applyThemeBtn">適用</button>
    <button id="closeThemeBtn">閉じる ✖</button>
  `;

  document.body.appendChild(panel);

  // 適用ボタン
  document.getElementById("applyThemeBtn").addEventListener("click", ()=>{
    themeConfig.seatBox.backgroundColor = document.getElementById("seatBgColor").value;
    themeConfig.playerEntry.backgroundColor = document.getElementById("playerBgColor").value;
    themeConfig.button.backgroundColor = document.getElementById("buttonBgColor").value;
    themeConfig.button.color = document.getElementById("buttonColor").value;
    themeConfig.fontSize = document.getElementById("fontSizeInput").value + "px";
    applyTheme();
  });

  // 閉じるボタン
  document.getElementById("closeThemeBtn").addEventListener("click", ()=>{
    panel.style.display = "none";
  });

  // ヘッダーに「テーマ編集」ボタンを追加
  const header = document.querySelector("header");
  if (!document.getElementById("openThemeBtn")) {
    const openBtn = document.createElement("button");
    openBtn.id = "openThemeBtn";
    openBtn.textContent = "テーマ編集";
    openBtn.style.marginLeft = "10px";
    openBtn.addEventListener("click", ()=>{
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });
    header.appendChild(openBtn);
  }
}

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

// =====================
// ナビゲーション
// =====================
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

// =====================
// QRコード読み取り
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
// プレイヤー削除
// =====================
function removePlayer(seatId, playerId){
  if(!passwordValidated){ displayMessage("⚠ 管理者モードでのみ操作可能です"); return; }
  const idx=seatMap[seatId]?.indexOf(playerId);
  if(idx===-1) return;
  seatMap[seatId].splice(idx,1);
  saveAction({type:"removePlayer", seatId, playerId, index: idx});
  saveToLocalStorage();
  renderSeats();

  douTakuRecords.push({seatId, playerId, action:"削除", time:new Date().toLocaleString()});
  localStorage.setItem("douTakuRecords", JSON.stringify(douTakuRecords));
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
  const list=document.getElementById("rankingList");
  const rankedIds=Array.from(list.children).map(li=>li.dataset.id);
  if(rankedIds.length<2){ displayMessage("⚠️ 2人以上で順位を登録してください"); return; }
  const entries=rankedIds.map((playerId,index)=>({playerId,rank:index+1}));
  const success=await postRankingUpdate(entries);
  if(!success){ displayMessage("❌ 順位の送信に失敗しました"); return; }
  displayMessage("✅ 順位を確定しました");
  if(currentRankingSeatId && seatMap[currentRankingSeatId]){
    seatMap[currentRankingSeatId]=[];
    currentRankingSeatId=null;
    renderSeats();
    stopRankCamera();
  }
}

// =====================
// GAS通信
// =====================
async function callGAS(payload={}, options={}) {
  const maxRetries = options.retries ?? 3;
  const timeoutMs  = options.timeout ?? 8000;
  let attempt=0;
  while(attempt<maxRetries){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const res=await fetch(GAS_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...payload,secret:SECRET}),
        signal:controller.signal
      });
      clearTimeout(timer);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }catch(e){ attempt++; await delay(1000); if(attempt>=maxRetries) throw e; }
  }
}

async function saveToGAS(seatMapData, playerDataObj){
  try{
    await callGAS({mode:"saveData", seatMap:seatMapData, playerData:playerDataObj});
    displayMessage("✅ データ保存成功");
  }catch(err){
    displayMessage("❌ 保存失敗");
    console.error(err);
  }
}

async function loadFromGAS(){
  try{
    const res=await callGAS({mode:"loadData"});
    seatMap=res.seatMap||{};
    playerData=res.playerData||{};
    renderSeats();
    displayMessage("✅ データ読み込み成功");
  }catch(err){
    displayMessage("❌ データ読み込み失敗");
    console.error(err);
  }
}

async function sendSeatData(tableID, playerIds, operator='webUser'){
  try{
    await callGAS({mode:"updatePlayers", tableID, players:playerIds, operator});
  }catch(err){
    console.error('座席送信失敗', err);
  }
}

async function postRankingUpdate(entries){
  try{
    await callGAS({mode:"updateRanking", rankings:entries});
    return true;
  }catch(err){
    console.error('順位送信失敗', err);
    return false;
  }
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

// =====================
// 初期化
// =====================
function bindButtons(){
  document.getElementById("undoBtn")?.addEventListener("click",undoAction);
  document.getElementById("redoBtn")?.addEventListener("click",redoAction);
  document.getElementById("exportPlayerBtn")?.addEventListener("click",exportPlayerCSV);
  document.getElementById("exportSeatBtn")?.addEventListener("click",exportSeatCSV);
  document.getElementById("confirmRankingBtn")?.addEventListener("click",finalizeRanking);
  document.getElementById("saveToGASBtn")?.addEventListener("click",()=>requireAuth(()=>saveToGAS(seatMap,playerData)));
  document.getElementById("loadFromGASBtn")?.addEventListener("click",()=>requireAuth(loadFromGAS));
}

document.addEventListener("DOMContentLoaded", async ()=>{
  try{ await loadFromGAS(); } catch(e){ console.warn("GASロード失敗,ローカル使用", e); }
  loadFromLocalStorage();
  renderSeats();
  bindButtons();
  startScanCamera();
  createThemePanel();
  applyTheme();
  window.addEventListener("scroll",()=>{
    if(scrollTimeout) clearTimeout(scrollTimeout);
    const st=window.pageYOffset||document.documentElement.scrollTop;
    if(st>lastScrollTop) sidebar?.classList.add("closed"); else sidebar?.classList.remove("closed");
    lastScrollTop=st<=0?0:st;
    scrollTimeout=setTimeout(()=>sidebar?.classList.remove("closed"),1500);
  });
});

Object.assign(window,{
  navigate,undoAction,redoAction,removePlayer,exportPlayerCSV,exportSeatCSV
});
