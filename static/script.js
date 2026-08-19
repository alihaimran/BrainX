const messagesEl = document.getElementById("messages");
const welcomeEl = document.getElementById("welcome");
const chatArea = document.getElementById("chatArea");
const form = document.getElementById("composerForm");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const imagePreview = document.getElementById("imagePreview");
const previewImg = document.getElementById("previewImg");
const removeImgBtn = document.getElementById("removeImg");
const newChatBtn = document.getElementById("newChatBtn");
const collapseBtn = document.getElementById("collapseBtn");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const sidebar = document.getElementById("sidebar");

let selectedImage = null;
let lastUserText = "";

// Auto-grow textarea
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

attachBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  selectedImage = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    imagePreview.hidden = false;
  };
  reader.readAsDataURL(file);
});

removeImgBtn.addEventListener("click", () => {
  selectedImage = null;
  fileInput.value = "";
  imagePreview.hidden = true;
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Lightweight markdown -> HTML renderer (headings, bold, italic, lists, code)
function renderMarkdown(raw) {
  let text = escapeHtml(raw);

  // Fenced code blocks first (protect their content)
  const codeBlocks = [];
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(code);
    return `\u0000CODEBLOCK${codeBlocks.length - 1}\u0000`;
  });

  // Inline code
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings
  text = text.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  text = text.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  text = text.replace(/^# (.*)$/gm, "<h1>$1</h1>");

  // Bold / italic
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // Lists: group consecutive "- " or "1. " lines
  const lines = text.split("\n");
  let html = "";
  let inUl = false, inOl = false;
  for (const line of lines) {
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ulMatch) {
      if (!inUl) { html += "<ul>"; inUl = true; }
      html += `<li>${ulMatch[1]}</li>`;
      continue;
    }
    if (inUl) { html += "</ul>"; inUl = false; }

    if (olMatch) {
      if (!inOl) { html += "<ol>"; inOl = true; }
      html += `<li>${olMatch[1]}</li>`;
      continue;
    }
    if (inOl) { html += "</ol>"; inOl = false; }

    if (/^<h[1-3]>/.test(line)) {
      html += line;
    } else if (line.trim() === "") {
      html += "<br>";
    } else {
      html += `<p>${line}</p>`;
    }
  }
  if (inUl) html += "</ul>";
  if (inOl) html += "</ol>";

  // Restore code blocks
  html = html.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (_, i) => {
    return `<pre><code>${codeBlocks[Number(i)]}</code></pre>`;
  });

  return html;
}

function addMessage(role, text, imageDataUrl) {
  welcomeEl.classList.add("hidden");
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "bubble-avatar";
  avatar.textContent = role === "user" ? "U" : "B";

  const wrap = document.createElement("div");
  wrap.className = "msg-wrap";

  const content = document.createElement("div");
  content.className = "msg-content";
  content.innerHTML = role === "assistant" ? renderMarkdown(text) : escapeHtml(text);

  if (imageDataUrl) {
    const img = document.createElement("img");
    img.className = "attached";
    img.src = imageDataUrl;
    content.appendChild(img);
  }

  wrap.appendChild(content);

  if (role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "msg-actions";
    actions.innerHTML = `
      <button type="button" class="msg-action-btn" data-action="copy" title="Copy">⧉</button>
      <button type="button" class="msg-action-btn" data-action="regenerate" title="Regenerate">↻</button>
    `;
    actions.querySelector('[data-action="copy"]').addEventListener("click", () => {
      navigator.clipboard.writeText(text);
    });
    actions.querySelector('[data-action="regenerate"]').addEventListener("click", () => {
      if (lastUserText) sendMessage(lastUserText, null);
    });
    wrap.appendChild(actions);
  }

  msg.appendChild(avatar);
  msg.appendChild(wrap);
  messagesEl.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
  return content;
}

function addTypingIndicator() {
  const msg = document.createElement("div");
  msg.className = "msg assistant";
  msg.id = "typingMsg";
  msg.innerHTML = `
    <div class="bubble-avatar">B</div>
    <div class="msg-wrap"><div class="msg-content"><div class="typing"><span></span><span></span><span></span></div></div></div>
  `;
  messagesEl.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById("typingMsg");
  if (el) el.remove();
}

async function sendMessage(text, imageFile) {
  const fd = new FormData();
  fd.append("message", text);
  if (imageFile) fd.append("image", imageFile);

  sendBtn.disabled = true;
  addTypingIndicator();

  try {
    const res = await fetch("/api/chat", { method: "POST", body: fd });
    const data = await res.json();
    removeTypingIndicator();
    if (!res.ok) {
      addMessage("assistant", `⚠️ ${data.error || "Something went wrong."}`);
    } else {
      addMessage("assistant", data.reply);
    }
  } catch (err) {
    removeTypingIndicator();
    addMessage("assistant", "⚠️ Network error. Please try again.");
  } finally {
    sendBtn.disabled = false;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text && !selectedImage) return;

  const imgUrl = previewImg.src && !imagePreview.hidden ? previewImg.src : null;
  addMessage("user", text || "(image)", imgUrl);
  lastUserText = text;

  const imgToSend = selectedImage;
  input.value = "";
  input.style.height = "auto";
  selectedImage = null;
  fileInput.value = "";
  imagePreview.hidden = true;

  await sendMessage(text, imgToSend);
});

newChatBtn.addEventListener("click", async () => {
  await fetch("/api/new_chat", { method: "POST" });
  messagesEl.innerHTML = "";
  welcomeEl.classList.remove("hidden");
});

collapseBtn.addEventListener("click", () => sidebar.classList.toggle("collapsed"));
mobileMenuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
const messagesEl = document.getElementById("messages");
const welcomeEl = document.getElementById("welcome");
const chatArea = document.getElementById("chatArea");
const form = document.getElementById("composerForm");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const imagePreview = document.getElementById("imagePreview");
const previewImg = document.getElementById("previewImg");
const removeImgBtn = document.getElementById("removeImg");
const newChatBtn = document.getElementById("newChatBtn");
const collapseBtn = document.getElementById("collapseBtn");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const sidebar = document.getElementById("sidebar");
const historyList = document.getElementById("historyList");
const userEmailLabel = document.getElementById("userEmailLabel");
const logoutBtn = document.getElementById("logoutBtn");
const navItems = document.querySelectorAll(".nav-item");

// ---------- Auth guard ----------
if (localStorage.getItem("brainx_logged_in") !== "true") {
  window.location.href = "/";
}
const userEmail = localStorage.getItem("brainx_user_email") || "Free plan";
if (userEmailLabel) userEmailLabel.textContent = userEmail;

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("brainx_logged_in");
  window.location.href = "/";
});

// ---------- Multi-chat state (persisted in localStorage) ----------
let selectedImage = null;
let chats = JSON.parse(localStorage.getItem("brainx_chats") || "{}");
let activeChatId = localStorage.getItem("brainx_active_chat");

function saveChats() {
  localStorage.setItem("brainx_chats", JSON.stringify(chats));
}

function renderHistoryList() {
  historyList.innerHTML = "";
  const ids = Object.keys(chats).sort((a, b) => chats[b].updatedAt - chats[a].updatedAt);
  for (const id of ids) {
    const item = document.createElement("div");
    item.className = "history-item" + (id === activeChatId ? " active" : "");
    item.textContent = chats[id].title || "New chat";
    item.addEventListener("click", () => setActiveChat(id));
    historyList.appendChild(item);
  }
}

function setActiveChat(id) {
  activeChatId = id;
  localStorage.setItem("brainx_active_chat", id);
  renderHistoryList();
  messagesEl.innerHTML = "";
  const msgs = chats[id]?.messages || [];
  if (msgs.length === 0) {
    welcomeEl.classList.remove("hidden");
  } else {
    welcomeEl.classList.add("hidden");
    for (const m of msgs) addMessage(m.role, m.text, m.image, false);
  }
}

function ensureActiveChat() {
  if (activeChatId && chats[activeChatId]) return activeChatId;
  const id = crypto.randomUUID();
  chats[id] = { title: "New chat", messages: [], updatedAt: Date.now() };
  activeChatId = id;
  localStorage.setItem("brainx_active_chat", id);
  saveChats();
  return id;
}

function persistMessage(role, text, image) {
  const id = ensureActiveChat();
  chats[id].messages.push({ role, text, image: image || null });
  if (role === "user" && chats[id].title === "New chat") {
    chats[id].title = (text || "Image chat").slice(0, 32);
  }
  chats[id].updatedAt = Date.now();
  saveChats();
  renderHistoryList();
}

// ---------- Auto-grow textarea ----------
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

attachBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  selectedImage = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    imagePreview.hidden = false;
  };
  reader.readAsDataURL(file);
});

removeImgBtn.addEventListener("click", () => {
  selectedImage = null;
  fileInput.value = "";
  imagePreview.hidden = true;
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Lightweight markdown -> HTML renderer (headings, bold, italic, lists, code)
function renderMarkdown(raw) {
  let text = escapeHtml(raw);

  const codeBlocks = [];
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    codeBlocks.push(code);
    return `\u0000CODEBLOCK${codeBlocks.length - 1}\u0000`;
  });

  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  text = text.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  text = text.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, "<em>$1</em>");

  const lines = text.split("\n");
  let html = "";
  let inUl = false, inOl = false;
  for (const line of lines) {
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ulMatch) {
      if (!inUl) { html += "<ul>"; inUl = true; }
      html += `<li>${ulMatch[1]}</li>`;
      continue;
    }
    if (inUl) { html += "</ul>"; inUl = false; }

    if (olMatch) {
      if (!inOl) { html += "<ol>"; inOl = true; }
      html += `<li>${olMatch[1]}</li>`;
      continue;
    }
    if (inOl) { html += "</ol>"; inOl = false; }

    if (/^<h[1-3]>/.test(line)) {
      html += line;
    } else if (line.trim() === "") {
      html += "<br>";
    } else {
      html += `<p>${line}</p>`;
    }
  }
  if (inUl) html += "</ul>";
  if (inOl) html += "</ol>";

  html = html.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (_, i) => {
    return `<pre><code>${codeBlocks[Number(i)]}</code></pre>`;
  });

  return html;
}

function addMessage(role, text, imageDataUrl, persist = true) {
  welcomeEl.classList.add("hidden");
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "bubble-avatar";
  avatar.textContent = role === "user" ? "U" : "B";

  const wrap = document.createElement("div");
  wrap.className = "msg-wrap";

  const content = document.createElement("div");
  content.className = "msg-content";
  content.innerHTML = role === "assistant" ? renderMarkdown(text) : escapeHtml(text);

  if (imageDataUrl) {
    const img = document.createElement("img");
    img.className = "attached";
    img.src = imageDataUrl;
    content.appendChild(img);
  }

  wrap.appendChild(content);

  if (role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "msg-actions";
    actions.innerHTML = `
      <button type="button" class="msg-action-btn" data-action="copy" title="Copy">⧉</button>
    `;
    actions.querySelector('[data-action="copy"]').addEventListener("click", () => {
      navigator.clipboard.writeText(text);
    });
    wrap.appendChild(actions);
  }

  msg.appendChild(avatar);
  msg.appendChild(wrap);
  messagesEl.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;

  if (persist) persistMessage(role, text, imageDataUrl);
  return content;
}

function addTypingIndicator() {
  const msg = document.createElement("div");
  msg.className = "msg assistant";
  msg.id = "typingMsg";
  msg.innerHTML = `
    <div class="bubble-avatar">B</div>
    <div class="msg-wrap"><div class="msg-content"><div class="typing"><span></span><span></span><span></span></div></div></div>
  `;
  messagesEl.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById("typingMsg");
  if (el) el.remove();
}

async function sendMessage(text, imageFile) {
  const id = ensureActiveChat();
  const fd = new FormData();
  fd.append("message", text);
  fd.append("chat_id", id);
  if (imageFile) fd.append("image", imageFile);

  sendBtn.disabled = true;
  addTypingIndicator();

  try {
    const res = await fetch("/api/chat", { method: "POST", body: fd });
    const data = await res.json();
    removeTypingIndicator();
    if (!res.ok) {
      addMessage("assistant", `⚠️ ${data.error || "Something went wrong."}`);
    } else {
      addMessage("assistant", data.reply);
    }
  } catch (err) {
    removeTypingIndicator();
    addMessage("assistant", "⚠️ Network error. Please try again.");
  } finally {
    sendBtn.disabled = false;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text && !selectedImage) return;

  const imgUrl = previewImg.src && !imagePreview.hidden ? previewImg.src : null;
  addMessage("user", text || "(image)", imgUrl);

  const imgToSend = selectedImage;
  input.value = "";
  input.style.height = "auto";
  selectedImage = null;
  fileInput.value = "";
  imagePreview.hidden = true;

  await sendMessage(text, imgToSend);
});

newChatBtn.addEventListener("click", () => {
  const id = crypto.randomUUID();
  chats[id] = { title: "New chat", messages: [], updatedAt: Date.now() };
  activeChatId = id;
  localStorage.setItem("brainx_active_chat", id);
  saveChats();
  renderHistoryList();
  messagesEl.innerHTML = "";
  welcomeEl.classList.remove("hidden");
});

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    welcomeEl.classList.add("hidden");
    messagesEl.innerHTML = "";
    const label = btn.querySelector("span").textContent;
    messagesEl.innerHTML = `<div class="soon-msg">🚧 <strong>${label}</strong> is coming soon to BrainX.</div>`;
  });
});

collapseBtn.addEventListener("click", () => sidebar.classList.toggle("collapsed"));
mobileMenuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));

// ---------- Init ----------
if (activeChatId && chats[activeChatId]) {
  setActiveChat(activeChatId);
} else {
  renderHistoryList();
}