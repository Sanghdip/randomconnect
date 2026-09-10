import {
  getMe, updateName, joinMatchmaking, leaveMatchmaking, getConversations,
  getConversation, sendMessage, blockUser, reportUser, getUserId
} from "./api.js";
import { WebRTCManager } from "./webrtc.js";

let me: any;
let activeConversation: any = null;
let ws: WebSocket | null = null;
let webrtc: WebRTCManager | null = null;
let isSearching = false;

const app = document.querySelector<HTMLDivElement>("#app")!;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[ch]!));
}

function layout(content: string) {
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand">Random<span>Connect</span></div>
        <nav>
          <button data-view="home">Home</button>
          <button data-view="history">History</button>
          <button data-view="settings">Settings</button>
        </nav>
        <div class="identity">${escapeHtml(me.displayName)}</div>
      </header>
      <main class="content">${content}</main>
    </div>`;
  app.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(btn => {
    btn.onclick = () => renderView(btn.dataset.view || "home");
  });
}

function home() {
  layout(`
    <section class="hero">
      <p class="eyebrow">ANONYMOUS • FAST • PRIVATE</p>
      <h1>Talk to someone new.</h1>
      <p class="subtitle">Randomly match with another person for text or video chat. Stop or move to the next stranger at any time.</p>
      <div class="action-row">
        <button class="primary" id="startText">Start random chat</button>
        <button class="secondary" id="startVideo">Start video chat</button>
      </div>
      <div class="safety-card">
        <strong>Safety first</strong>
        <span>Block or report users, never share sensitive information, and leave a call whenever you are uncomfortable.</span>
      </div>
    </section>`);
  app.querySelector("#startText")!.addEventListener("click", () => startRandom(false));
  app.querySelector("#startVideo")!.addEventListener("click", () => startRandom(true));
}

async function startRandom(video: boolean) {
  isSearching = true;
  renderSearching(video);
  await ensureSocket();
  await joinMatchmaking();
}

function renderSearching(video: boolean) {
  layout(`
    <section class="center-card">
      <div class="spinner"></div>
      <p class="eyebrow">MATCHMAKING</p>
      <h2>Finding a stranger…</h2>
      <p>Keep this tab open. You can cancel whenever you want.</p>
      <button class="secondary" id="cancelSearch">Cancel</button>
    </section>`);
  app.querySelector("#cancelSearch")!.addEventListener("click", async () => {
    await leaveMatchmaking();
    isSearching = false;
    home();
  });
}

function chatView() {
  layout(`
    <section class="chat-shell">
      <div class="chat-header">
        <div>
          <p class="eyebrow">CONNECTED</p>
          <h2>${escapeHtml(activeConversation?.other?.displayName || "Stranger")}</h2>
        </div>
        <div class="action-row">
          <button class="secondary" id="reportBtn">Report</button>
          <button class="danger" id="nextBtn">Next stranger</button>
        </div>
      </div>
      <div class="chat-messages" id="messages"></div>
      <form id="sendForm" class="composer">
        <input id="messageInput" autocomplete="off" maxlength="4000" placeholder="Write a message..." />
        <button class="primary">Send</button>
      </form>
    </section>`);
  loadMessages();
  app.querySelector("#sendForm")!.addEventListener("submit", async e => {
    e.preventDefault();
    const input = app.querySelector<HTMLInputElement>("#messageInput")!;
    const value = input.value.trim();
    if (!value || !activeConversation) return;
    await sendMessage(activeConversation.id, value);
    input.value = "";
    loadMessages();
  });
  app.querySelector("#nextBtn")!.addEventListener("click", () => nextStranger(false));
  app.querySelector("#reportBtn")!.addEventListener("click", reportFlow);
}

function videoView() {
  layout(`
    <section class="video-shell">
      <div class="chat-header">
        <div><p class="eyebrow">VIDEO CHAT</p><h2>${escapeHtml(activeConversation?.other?.displayName || "Stranger")}</h2></div>
        <div class="action-row">
          <button class="secondary" id="micBtn">Mic</button>
          <button class="secondary" id="camBtn">Camera</button>
          <button class="secondary" id="shareBtn">Share screen</button>
          <button class="danger" id="nextBtn">Next stranger</button>
        </div>
      </div>
      <div class="videos">
        <div class="video-card remote"><video id="remoteVideo" autoplay playsinline></video><span>Stranger</span></div>
        <div class="video-card local"><video id="localVideo" autoplay muted playsinline></video><span>You</span></div>
      </div>
    </section>`);
  const remote = app.querySelector<HTMLVideoElement>("#remoteVideo")!;
  const local = app.querySelector<HTMLVideoElement>("#localVideo")!;
  const sendSignal = (payload: any) => ws?.send(JSON.stringify(payload));
  webrtc = new WebRTCManager(local, remote, sendSignal);
  const start = async () => {
    await webrtc!.start(activeConversation.other.id, iceServers);
    if (me.id < activeConversation.other.id) await webrtc!.createOffer();
  };
  start().catch(err => alert(`Camera/microphone access failed: ${err.message}`));
  app.querySelector("#micBtn")!.addEventListener("click", () => webrtc?.toggleMic());
  app.querySelector("#camBtn")!.addEventListener("click", () => webrtc?.toggleCamera());
  app.querySelector("#shareBtn")!.addEventListener("click", () => webrtc?.shareScreen());
  app.querySelector("#nextBtn")!.addEventListener("click", () => nextStranger(true));
}

let iceServers: RTCIceServer[] = [];

async function ensureSocket() {
  if (ws?.readyState === WebSocket.OPEN) return;
  await new Promise<void>((resolve, reject) => {
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?userId=${encodeURIComponent(getUserId())}`);
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("WebSocket connection failed"));
    ws.onmessage = async event => {
      const msg = JSON.parse(event.data);
      if (msg.type === "ready") {
        iceServers = msg.iceServers || [];
        return;
      }
      if (msg.type === "match_found") {
        activeConversation = msg.conversation;
        activeConversation.other = msg.peer.id === me.id ? { id: msg.conversation.participantIds.find((x: string) => x !== me.id), displayName: "Stranger" } : msg.peer;
        // Fetch the authoritative conversation record.
        activeConversation = await getConversation(activeConversation.id);
        if (location.hash === "#video") videoView(); else chatView();
      }
      if (msg.type === "chat_message" && activeConversation?.id === msg.message.conversationId) {
        loadMessages();
      }
      if (msg.type === "webrtc_offer" && webrtc) {
        await webrtc.acceptOffer(msg.offer);
      }
      if (msg.type === "webrtc_answer" && webrtc) {
        await webrtc.acceptAnswer(msg.answer);
      }
      if (msg.type === "ice_candidate" && webrtc) {
        await webrtc.addCandidate(msg.candidate);
      }
    };
  });
}

async function loadMessages() {
  if (!activeConversation) return;
  activeConversation = await getConversation(activeConversation.id);
  const el = app.querySelector<HTMLDivElement>("#messages");
  if (!el) return;
  el.innerHTML = activeConversation.messages.map((m: any) =>
    `<div class="message ${m.senderId === me.id ? "mine" : ""}">
      <span>${escapeHtml(m.body)}</span><small>${new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</small>
    </div>`).join("") || `<div class="empty">No messages yet. Say hello.</div>`;
  el.scrollTop = el.scrollHeight;
}

async function nextStranger(video: boolean) {
  webrtc?.end();
  webrtc = null;
  activeConversation = null;
  location.hash = video ? "#video" : "#chat";
  await leaveMatchmaking();
  await startRandom(video);
}

async function historyView() {
  const data = await getConversations();
  layout(`
    <section class="panel">
      <p class="eyebrow">HISTORY</p><h2>Your conversations</h2>
      <div class="history-list">
        ${data.conversations.map((c:any) => `<button class="history-item" data-id="${c.id}">
          <strong>${escapeHtml(c.other?.displayName || "Stranger")}</strong>
          <span>${escapeHtml(c.lastMessage?.body || "No messages")}</span>
        </button>`).join("") || `<div class="empty">No saved conversations yet.</div>`}
      </div>
    </section>`);
  app.querySelectorAll<HTMLButtonElement>(".history-item").forEach(btn => btn.onclick = async () => {
    activeConversation = await getConversation(btn.dataset.id!);
    chatView();
  });
}

function settingsView() {
  layout(`
    <section class="panel small">
      <p class="eyebrow">SETTINGS</p><h2>Profile</h2>
      <form id="nameForm">
        <label>Display name</label>
        <input id="name" maxlength="32" value="${escapeHtml(me.displayName)}" />
        <button class="primary">Save</button>
      </form>
    </section>`);
  app.querySelector("#nameForm")!.addEventListener("submit", async e => {
    e.preventDefault();
    const value = (app.querySelector<HTMLInputElement>("#name")!).value;
    me = await updateName(value);
    home();
  });
}

function reportFlow() {
  const reason = prompt("Reason: spam, harassment, sexual-content, hate, violence, other", "other") || "other";
  reportUser(activeConversation.other.id, reason).then(() => alert("Reported and blocked."));
}

function renderView(view?: string) {
  if (view === "history") return historyView();
  if (view === "settings") return settingsView();
  return home();
}

async function boot() {
  me = await getMe();
  await ensureSocket();
  renderView("home");
}

boot().catch(err => {
  app.innerHTML = `<section class="center-card"><h2>Startup error</h2><p>${escapeHtml(err.message)}</p><button class="primary" onclick="location.reload()">Reload</button></section>`;
});
