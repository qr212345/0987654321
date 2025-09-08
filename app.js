let qrReader, scanQr, rankQr;
const GAS_URL = "https://script.google.com/macros/s/AKfycbygpqW4VYNm__Wip39CwAwoyitrTi4CPAg4N6lH7WPOPkcU37LbzS2XiNn-xvWzEI84/exec";
const SECRET = "your-secret-key";
const SCAN_COOLDOWN_MS = 1500;
const MAX_PLAYERS_PER_SEAT = 6;

// 状態管理
let seatMap = {};
let playerData = {};
let undoStack = [], redoStack = [];
let douTakuRecords = JSON.parse(localStorage.getItem("douTakuRecords") || "[]");
let currentSeatId = null;
let lastScannedText = null, lastScanTime = 0;
let isScanCameraStarting = false, isRankCameraStarting = false;
let isRankingMode = false, currentRankingSeatId = null;
let passwordValidated = false;
let timerInterval, remaining = 0;

// テーマ
let themeConfig = {
  seatBox: { backgroundColor: "#f5f5f5", color: "#000000" },
  playerEntry: { backgroundColor: "#d0f0c0", color: "#000000" },
  button: { backgroundColor: "#4CAF50", color: "#ffffff" },
  fontSize: "14px"
};

function expandHexColor(hex){ if(/^#([0-9a-f]{3})$/i.test(hex)) return "#" + hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]; return hex; }

function applyTheme(){
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

function createThemePanel(){
  const existing=document.getElementById("themePanel");
  if(existing) existing.remove();
  const panel=document.createElement("div");
  panel.id="themePanel"; Object.assign(panel.style,{
    position:"fixed", top:"10px", right:"10px", width:"250px",
    backgroundColor:"#fff", border:"1px solid #ccc", padding:"10px",
    borderRadius:"8px", boxShadow:"0 2px 6px rgba(0,0,0,0.2)",
    zIndex:1000, display:"none"
  });
  panel.innerHTML=`
    <h4 style="margin-top:0;">
      テーマ編集
      <button id="closeThemeBtn" style="float:right;background:#f44336;color:#fff;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;">×</button>
    </h4>
    <label>座席背景: <input type="color" id="seatBgColor" value="${expandHexColor(themeConfig.seatBox.backgroundColor)}"></label><br>
    <label>プレイヤー背景: <input type="color" id="playerBgColor" value="${expandHexColor(themeConfig.playerEntry.backgroundColor)}"></label><br>
    <label>ボタン背景: <input type="color" id="buttonBgColor" value="${expandHexColor(themeConfig.button.backgroundColor)}"></label><br>
    <label>ボタン文字色: <input type="color" id="buttonColor" value="${expandHexColor(themeConfig.button.color)}"></label><br>
    <label>フォントサイズ: <input type="number" id="fontSizeInput" value="${parseInt(themeConfig.fontSize)}" style="width:60px">px</label><br>
    <button id="applyThemeBtn">適用</button>
  `;
  document.body.appendChild(panel);
  document.getElementById("applyThemeBtn").addEventListener("click",()=>{
    themeConfig.seatBox.backgroundColor=document.getElementById("seatBgColor").value;
    themeConfig.playerEntry.backgroundColor=document.getElementById("playerBgColor").value;
    themeConfig.button.backgroundColor=document.getElementById("buttonBgColor").value;
    themeConfig.button.color=document.getElementById("buttonColor").value;
    themeConfig.fontSize=document.getElementById("fontSizeInput").value+"px";
    applyTheme();
  });
  document.getElementById("closeThemeBtn").addEventListener("click",()=>panel.style.display="none");
  const header=document.querySelector("header");
  if(header && !document.getElementById("openThemeBtn")){
    const btn=document.createElement("button");
    btn.id="openThemeBtn"; btn.textContent="テーマ編集";
    btn.style.marginLeft="10px";
    btn.addEventListener("click",()=>panel.style.display=panel.style.display==="none"?"block":"none");
    header.appendChild(btn);
  }
}

// ユーティリティ
const delay=ms=>new Promise(res=>setTimeout(res,ms));
function displayMessage(msg){
  const area=document.getElementById("messageArea");
  if(!area) return;
  area.textContent=msg;
  clearTimeout(area.timer);
  area.timer=setTimeout(()=>area.textContent="",3000);
}
async function requireAuth(callback){
  if(passwordValidated){ callback(); return; }
  const pw=prompt("パスワードを入力してください");
  if(pw==="supersecret"){ passwordValidated=true; callback(); }
  else alert("認証失敗");
}
function notifyAction(message){
  const msg=document.createElement("div"); msg.className="notify-popup"; msg.textContent=message;
  document.body.appendChild(msg);
  setTimeout(()=>msg.remove(),3000);
  const audio=new Audio("https://freesound.org/data/previews/170/170186_2437358-lq.mp3");
  audio.play().catch(()=>{});
}

// タイマー
function startTimer(minutes){
  remaining=minutes*60; updateTimer();
  clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    remaining--; updateTimer();
    if(remaining<=0){ clearInterval(timerInterval); notifyAction("⏰ タイムアップ！"); }
  },1000);
}
function updateTimer(){
  const m=String(Math.floor(remaining/60)).padStart(2,"0");
  const s=String(remaining%60).padStart(2,"0");
  document.getElementById("timerDisplay")&&(document.getElementById("timerDisplay").textContent=`${m}:${s}`);
}

// LocalStorage
function saveToLocalStorage(){
  localStorage.setItem("seatMap",JSON.stringify(seatMap));
  localStorage.setItem("playerData",JSON.stringify(playerData));
}
function loadFromLocalStorage(){
  seatMap=JSON.parse(localStorage.getItem("seatMap")||"{}");
  playerData=JSON.parse(localStorage.getItem("playerData")||"{}");
}

// Undo / Redo
function saveAction(action){ undoStack.push(action); redoStack=[]; }
function undo(){ if(!undoStack.length) return; const action=undoStack.pop(); redoStack.push(action); applyUndoRedo(action,true); }
function redo(){ if(!redoStack.length) return; const action=redoStack.pop(); undoStack.push(action); applyUndoRedo(action,false); }
function applyUndoRedo(action,isUndo){
  switch(action.type){
    case "addPlayer": if(isUndo) seatMap[action.seatId]=seatMap[action.seatId].filter(p=>p!==action.playerId); else seatMap[action.seatId].push(action.playerId); break;
    case "removePlayer": if(isUndo) seatMap[action.seatId].push(action.playerId); else seatMap[action.seatId]=seatMap[action.seatId].filter(p=>p!==action.playerId); break;
  }
  renderSeats(); saveToLocalStorage();
}

// 座席描画
function renderSeats(){
  const container=document.getElementById("seatContainer");
  if(!container) return;
  container.innerHTML="";
  Object.keys(seatMap).forEach(seatId=>{
    const seatBox=document.createElement("div"); seatBox.className="seat-box"; seatBox.dataset.seatId=seatId; seatBox.textContent=seatId;
    const ul=document.createElement("ul");
    seatMap[seatId].forEach(playerId=>{
      const li=document.createElement("li"); li.className="player-entry"; li.textContent=playerId; li.dataset.playerId=playerId; ul.appendChild(li);
    });
    seatBox.appendChild(ul); container.appendChild(seatBox);
  });
  applyTheme();
  enableDragSort();
}

// QR読み取り
function handleScanSuccess(decodedText){
  const now=Date.now();
  if(decodedText===lastScannedText && now-lastScanTime<SCAN_COOLDOWN_MS) return;
  lastScannedText=decodedText; lastScanTime=now;
  const resultEl=document.getElementById("result"); if(resultEl) resultEl.textContent=`📷 ${decodedText} を読み取りました`;

  if(decodedText.startsWith("table")){
    currentSeatId=decodedText; seatMap[currentSeatId]??=[];
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

    douTakuRecords.push({seatId: currentSeatId, playerId: decodedText, action:"登録", time:new Date().toLocaleString()});
    localStorage.setItem("douTakuRecords",JSON.stringify(douTakuRecords));
  }
}

// 座席追加・削除
function addPlayerToSeat(seatId,playerId){
  if(!passwordValidated){ displayMessage("⚠ 管理者モードでのみ操作可能です"); return; }
  seatMap[seatId]??=[];
  if(seatMap[seatId].includes(playerId)){ displayMessage("⚠ 既に登録済み"); return; }
  if(seatMap[seatId].length>=MAX_PLAYERS_PER_SEAT){ displayMessage(`⚠ この座席は${MAX_PLAYERS_PER_SEAT}人まで`); return; }
  seatMap[seatId].push(playerId);
  playerData[playerId]??={nickname:playerId};
  saveAction({type:"addPlayer",seatId,playerId});
  renderSeats(); saveToLocalStorage();
}

function removePlayer(seatId,playerId){
  if(!passwordValidated){ displayMessage("⚠ 管理者モードでのみ操作可能です"); return; }
  seatMap[seatId]?.includes(playerId) && seatMap[seatId].splice(seatMap[seatId].indexOf(playerId),1);
  saveAction({type:"removePlayer",seatId,playerId}); renderSeats(); saveToLocalStorage();
}

// GAS通信
async function sendSeatData(seatId,players,user){
  try{
    await fetch(GAS_URL,{
      method:"POST",
      body:JSON.stringify({seatId,players,user,secret:SECRET}),
      headers:{"Content-Type":"application/json"}
    });
  }catch(e){ console.error(e); }
}
async function postRankingUpdate(rankedPlayers){
  const lines=[`secret=${SECRET}`];
  rankedPlayers.forEach(({playerId,rank})=>lines.push([playerId,rank].join(",")));
  try{
    await fetch(GAS_URL,{method:"POST",body:lines.join("\n"),headers:{"Content-Type":"text/csv"}});
  }catch(e){ console.error(e); }
}

// ランキング
function handleRankingScan(seatQr){ currentRankingSeatId=seatQr; displayMessage(`順位登録開始: ${seatQr}`); }
function finalizeRanking(){
  const list=document.getElementById("rankingList"); if(!list) return;
  const rankedIds=Array.from(list.children).map(li=>li.dataset.id);
  if(rankedIds.length<2){ displayMessage("⚠ 2人以上必要"); return; }
  rankedIds.forEach(pid=>seatMap[currentRankingSeatId]=seatMap[currentRankingSeatId].filter(p=>p!==pid));
  postRankingUpdate(rankedIds.map((pid,i)=>({playerId:pid,rank:i+1})));
  saveToLocalStorage(); renderSeats(); displayMessage("🏆 順位登録完了");
}

// 履歴表示
function loadDouTakuHistory(){
  const historyEl=document.getElementById("historyList"); if(!historyEl) return;
  historyEl.innerHTML="";
  douTakuRecords.forEach(rec=>{ const li=document.createElement("li"); li.textContent=`[${rec.time}] ${rec.seatId} : ${rec.playerId} (${rec.action})`; historyEl.appendChild(li); });
}
function exportHistoryCSV(){
  let csv="seatId,playerId,action,time\n"; douTakuRecords.forEach(r=>{ csv+=`${r.seatId},${r.playerId},${r.action},${r.time}\n`; });
  const blob=new Blob([csv],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="history.csv"; a.click(); URL.revokeObjectURL(url);
}

// ドラッグ＆ドロップ
function enableDragSort(){
  document.querySelectorAll(".player-entry").forEach(el=>{
    el.draggable=true;
    el.addEventListener("dragstart", e=>e.dataTransfer.setData("text/plain", el.dataset.playerId));
  });
  document.querySelectorAll(".seat-box ul").forEach(ul=>{
    ul.addEventListener("dragover", e=>e.preventDefault());
    ul.addEventListener("drop", e=>{
      e.preventDefault();
      const pid=e.dataTransfer.getData("text/plain");
      const fromSeat=findPlayerSeat(pid);
      const toSeat=ul.parentElement.dataset.seatId;
      if(!fromSeat||!toSeat) return;
      seatMap[fromSeat]=seatMap[fromSeat].filter(p=>p!==pid);
      seatMap[toSeat].push(pid);
      renderSeats(); saveToLocalStorage(); sendSeatData(toSeat,seatMap[toSeat],'webUser');
    });
  });
}
function findPlayerSeat(playerId){ return Object.keys(seatMap).find(sid=>seatMap[sid].includes(playerId)); }

// QRカメラ
async function startScanCamera(){
  if(isScanCameraStarting) return; isScanCameraStarting=true;
  scanQr=new Html5Qrcode("cameraContainer");
  await scanQr.start({facingMode:"environment"},{fps:10,qrbox:250},handleScanSuccess).catch(e=>displayMessage("❌ カメラ起動失敗"));
  isScanCameraStarting=false;
}
async function stopScanCamera(){ if(scanQr) await scanQr.stop(); }
async function startRankCamera(){
  if(isRankCameraStarting) return; isRankCameraStarting=true;
  rankQr=new Html5Qrcode("cameraContainer");
  await rankQr.start({facingMode:"environment"},{fps:10,qrbox:250},handleScanSuccess).catch(e=>displayMessage("❌ 順位登録カメラ起動失敗"));
  isRankCameraStarting=false;
}
async function stopRankCamera(){ if(rankQr) await rankQr.stop(); }

// ナビゲーション
function navigate(targetId){
  document.querySelectorAll(".section").forEach(s=>s.style.display="none");
  const t=document.getElementById(targetId); if(t) t.style.display="block";
  location.hash=targetId;
  switch(targetId){
    case "historySection": loadDouTakuHistory(); break;
    case "rankingSection":
      requireAuth(()=>{
        isRankingMode=true; currentRankingSeatId=null;
        document.getElementById("rankingList")&&(document.getElementById("rankingList").innerHTML="");
        displayMessage("座席QR を読み込んでください（順位登録モード）");
        startRankCamera();
      }); break;
    case "scanSection":
      isRankingMode=false;
      stopRankCamera().then(startScanCamera);
      break;
  }
}
async function navigateAsync(sectionId){ navigate(sectionId); await delay(300); }

// 初期化
window.addEventListener("load",()=>{
  loadFromLocalStorage(); renderSeats(); applyTheme();
  createThemePanel(); enableDragSort(); startScanCamera();
  document.getElementById("undoBtn")?.addEventListener("click",undo);
  document.getElementById("redoBtn")?.addEventListener("click",redo);
  document.getElementById("startTimerBtn")?.addEventListener("click",()=>startTimer(parseInt(document.getElementById("timerMinutes").value)));
  document.getElementById("resetTimerBtn")?.addEventListener("click",()=>{ clearInterval(timerInterval); document.getElementById("timerDisplay")&&(document.getElementById("timerDisplay").textContent="00:00"); });
  window.addEventListener("resize",()=>{ if(scanQr) scanQr.stop().then(startScanCamera); });
  navigate("scanSection");
});
