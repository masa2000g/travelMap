const firebaseConfig = {
  apiKey: "AIzaSyBtUbgKYgFwrQmES7rmZSCN0TaAV3aPKKI",
  authDomain: "sharetravelinfolikedq.firebaseapp.com",
  databaseURL: "https://sharetravelinfolikedq-default-rtdb.firebaseio.com",
  projectId: "sharetravelinfolikedq"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(); // Use Firestore
const playerStatusDocRef = db.collection("meta").doc("playerStatus");
const budgetsDocRef = db.collection("meta").doc("budgets");

const PLAYER_STATUS_FIELDS = ["level", "hp", "mp", "gold", "condition"];
const PLAYER_STATUS_DEFAULTS = {
  level: "",
  hp: "",
  mp: "",
  gold: "",
  condition: ""
};

// --- DOM Elements ---
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const appForm = document.getElementById('appForm');
const statusEl = document.getElementById('status');
const logContainer = document.getElementById('logContainer');
const stars = document.querySelectorAll('.star-rating .star');
const locationNameInput = document.getElementById('locationNameInput');
const actionInput = document.getElementById('actionInput');
const categorySelect = document.getElementById('categorySelect');
const amountInputEl = document.getElementById('amountInput');
const statusEditorSection = document.getElementById('status-editor');
const statusForm = document.getElementById('statusForm');
const statusSaveState = document.getElementById('statusSaveState');
const statusInputs = {
  level: document.getElementById('statusLevel'),
  hp: document.getElementById('statusHp'),
  mp: document.getElementById('statusMp'),
  gold: document.getElementById('statusGold'),
  condition: document.getElementById('statusCondition')
};
const budgetEditorSection = document.getElementById('budget-editor');
const budgetForm = document.getElementById('budgetForm');
const budgetSaveState = document.getElementById('budgetSaveState');
const budgetInputs = document.querySelectorAll('[data-budget-category]');
const tabButtons = document.querySelectorAll('[data-tab-target]');
const tabPanels = document.querySelectorAll('.tab-panel');
const logSubmitBtn = document.getElementById('logSubmitBtn');
const formModeBanner = document.getElementById('formModeBanner');
const formModeText = document.getElementById('formModeText');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const clearRatingBtn = document.getElementById('clearRatingBtn');

const setActiveTab = (targetId) => {
  tabButtons.forEach(button => {
    const isActive = button.dataset.tabTarget === targetId;
    button.classList.toggle('active', isActive);
  });
  tabPanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === targetId);
  });
};

tabButtons.forEach(button => {
  button.addEventListener('click', () => setActiveTab(button.dataset.tabTarget));
});

setActiveTab('logTab');

let currentRating = null;
let currentLat = null;
let currentLng = null;
let unsubscribePlayerStatus = null;
let unsubscribeBudgets = null;
let editingLogId = null;
let editingMetadata = null;

const formatTimestamp = (value) => {
  if (!value) return "";
  const dateValue = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(dateValue.getTime()) ? "" : dateValue.toLocaleString();
};

const normalizeTimestamp = (value) => {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return value;
};

const setStarSelection = (value) => {
  stars.forEach(s => {
    const starValue = parseInt(s.dataset.value, 10);
    s.classList.toggle("selected", value !== null && starValue <= value);
  });
};

const resetFormFields = () => {
  appForm.reset();
  currentRating = null;
  setStarSelection(null);
};

const exitEditingMode = () => {
  editingLogId = null;
  editingMetadata = null;
  if (formModeBanner) {
    formModeBanner.hidden = true;
  }
  if (logSubmitBtn) {
    logSubmitBtn.textContent = "送信する";
  }
};

const resetFormState = () => {
  resetFormFields();
  exitEditingMode();
};

const beginEditLogEntry = (docId, entry) => {
  setActiveTab('logTab');
  editingLogId = docId;
  editingMetadata = {
    lat: entry.lat ?? null,
    lng: entry.lng ?? null,
    timestamp: normalizeTimestamp(entry.timestamp)
  };
  locationNameInput.value = entry.locationName || '';
  actionInput.value = entry.memo || '';
  if (categorySelect) {
    if (entry.amount_category) {
      categorySelect.value = entry.amount_category;
    } else {
      categorySelect.selectedIndex = 0;
    }
  }
  if (entry.amount !== undefined && entry.amount !== null) {
    amountInputEl.value = entry.amount;
  } else {
    amountInputEl.value = '';
  }
  currentRating = entry.stars ?? null;
  setStarSelection(currentRating);
  if (formModeBanner && formModeText) {
    formModeText.textContent = `${entry.locationName || '名称未設定'} を編集中`;
    formModeBanner.hidden = false;
  }
  if (logSubmitBtn) {
    logSubmitBtn.textContent = "更新する";
  }
  if (typeof appForm.scrollIntoView === 'function') {
    appForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', resetFormState);
}

// --- Authentication ---
loginBtn.addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  auth.signInWithEmailAndPassword(email, password)
    .catch(error => {
      alert('Login Failed: ' + error.message);
    });
});

logoutBtn.addEventListener('click', () => {
  auth.signOut();
});

auth.onAuthStateChanged(user => {
  if (user) {
    loginSection.style.display = 'none';
    appSection.style.display = 'block';
    initializeAppData();
  } else {
    loginSection.style.display = 'block';
    appSection.style.display = 'none';
    teardownPlayerStatusSubscription();
    teardownBudgetsSubscription();
    resetFormState();
    if (statusEditorSection) {
      statusEditorSection.style.display = 'none';
    }
    if (budgetEditorSection) {
      budgetEditorSection.style.display = 'none';
    }
  }
});

// --- Main App Logic ---
function initializeAppData() {
  // Get user's location
  navigator.geolocation.getCurrentPosition(pos => {
    currentLat = pos.coords.latitude;
    currentLng = pos.coords.longitude;
    statusEl.textContent = `位置情報取得成功：${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`;
  }, () => {
    statusEl.textContent = "位置情報の取得に失敗しました。";
  });

  // Setup event listeners only once
  if (!appForm.dataset.initialized) {
    appForm.dataset.initialized = true;
    setupEventListeners();
  }

  subscribePlayerStatus();
  subscribeBudgets();
  // Display logs from Firestore
  displayLogs();
}

function setupEventListeners() {
  // Star Rating
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const value = parseInt(star.dataset.value, 10);
      currentRating = value;
      setStarSelection(currentRating);
    });
  });

  if (clearRatingBtn) {
    clearRatingBtn.addEventListener('click', () => {
      currentRating = null;
      setStarSelection(null);
    });
  }

  // Form Submission
  appForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const locationName = locationNameInput.value;
    const memo = actionInput.value;
    const category = categorySelect.value;
    const amountValue = amountInputEl.value;
    const amount = amountValue === "" ? null : parseInt(amountValue, 10);

    if (!locationName || !category) {
      alert("場所の名前とカテゴリは必須です。");
      return;
    }

    const isEditing = Boolean(editingLogId);
    const latToUse = isEditing ? (editingMetadata?.lat ?? currentLat) : currentLat;
    const lngToUse = isEditing ? (editingMetadata?.lng ?? currentLng) : currentLng;
    const timestampToUse = isEditing ? (editingMetadata?.timestamp ?? new Date().toISOString()) : new Date().toISOString();

    const data = {
      stars: currentRating,
      locationName: locationName,
      memo: memo,
      amount_category: category,
      amount: amount,
      lat: latToUse,
      lng: lngToUse,
      timestamp: timestampToUse
    };

    try {
      if (isEditing) {
        await db.collection('logs').doc(editingLogId).update(data);
        alert("更新完了！");
      } else {
        await db.collection('logs').add(data);
        alert("送信完了！");
      }
      resetFormState();
    } catch (error) {
      alert("送信に失敗しました: " + error.message);
    }
  });

  if (!statusForm.dataset.initialized) {
    statusForm.dataset.initialized = true;
    statusForm.addEventListener("submit", handleStatusSubmit);
  }

  if (budgetForm && !budgetForm.dataset.initialized) {
    budgetForm.dataset.initialized = true;
    budgetForm.addEventListener("submit", handleBudgetSubmit);
  }
}

function subscribePlayerStatus() {
  if (!statusEditorSection || unsubscribePlayerStatus) return;
  statusEditorSection.style.display = 'block';
  unsubscribePlayerStatus = playerStatusDocRef.onSnapshot(doc => {
    const data = doc.exists ? doc.data() : PLAYER_STATUS_DEFAULTS;
    PLAYER_STATUS_FIELDS.forEach(field => {
      statusInputs[field].value = data[field] ?? PLAYER_STATUS_DEFAULTS[field];
    });
    statusSaveState.textContent = "最新のステータスを取得しました。";
  }, (error) => {
    statusSaveState.textContent = `取得に失敗しました: ${error.message}`;
  });
}

function teardownPlayerStatusSubscription() {
  if (typeof unsubscribePlayerStatus === "function") {
    unsubscribePlayerStatus();
    unsubscribePlayerStatus = null;
  }
  if (statusSaveState) {
    statusSaveState.textContent = "";
  }
}

function subscribeBudgets() {
  if (!budgetEditorSection || unsubscribeBudgets) return;
  budgetEditorSection.style.display = 'block';
  unsubscribeBudgets = budgetsDocRef.onSnapshot(doc => {
    const data = doc.exists ? doc.data() : {};
    budgetInputs.forEach(input => {
      const cat = input.dataset.budgetCategory;
      input.value = data && data[cat] !== undefined && data[cat] !== null ? data[cat] : "";
    });
    if (budgetSaveState) {
      budgetSaveState.textContent = "最新の予算を取得しました。";
    }
  }, (error) => {
    if (budgetSaveState) {
      budgetSaveState.textContent = `取得に失敗しました: ${error.message}`;
    }
  });
}

function teardownBudgetsSubscription() {
  if (typeof unsubscribeBudgets === "function") {
    unsubscribeBudgets();
    unsubscribeBudgets = null;
  }
  if (budgetSaveState) {
    budgetSaveState.textContent = "";
  }
  if (budgetInputs) {
    budgetInputs.forEach(input => { input.value = ""; });
  }
}

async function handleStatusSubmit(event) {
  event.preventDefault();
  if (!auth.currentUser) {
    statusSaveState.textContent = "ログイン後に更新してください。";
    return;
  }
  const payload = {};
  PLAYER_STATUS_FIELDS.forEach(field => {
    payload[field] = statusInputs[field].value.trim();
  });
  statusSaveState.textContent = "保存中...";
  try {
    await playerStatusDocRef.set(payload, { merge: true });
    const now = new Date();
    statusSaveState.textContent = `保存しました (${now.toLocaleTimeString()})`;
  } catch (error) {
    statusSaveState.textContent = `保存に失敗しました: ${error.message}`;
  }
}

async function handleBudgetSubmit(event) {
  event.preventDefault();
  if (!auth.currentUser) {
    if (budgetSaveState) budgetSaveState.textContent = "ログイン後に更新してください。";
    return;
  }
  const payload = {};
  budgetInputs.forEach(input => {
    const cat = input.dataset.budgetCategory;
    const val = input.value.trim();
    if (val === "") {
      payload[cat] = firebase.firestore.FieldValue.delete();
    } else {
      payload[cat] = Number(val);
    }
  });
  if (budgetSaveState) budgetSaveState.textContent = "保存中...";
  try {
    await budgetsDocRef.set(payload, { merge: true });
    if (budgetSaveState) {
      budgetSaveState.textContent = `保存しました (${new Date().toLocaleTimeString()})`;
    }
  } catch (error) {
    if (budgetSaveState) {
      budgetSaveState.textContent = `保存に失敗しました: ${error.message}`;
    }
  }
}

// --- Log Display (from Firestore) ---
function displayLogs() {
  db.collection('logs').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
    logContainer.innerHTML = '';
    if (snapshot.empty) {
      logContainer.innerHTML = '<p>ログはまだありません。</p>';
      return;
    }
    snapshot.forEach(doc => {
      const entry = doc.data();
      const div = document.createElement("div");
      div.className = "log-entry";
      div.dataset.docId = doc.id;
      const latText = typeof entry.lat === 'number' ? entry.lat.toFixed(4) : '--';
      const lngText = typeof entry.lng === 'number' ? entry.lng.toFixed(4) : '--';
      const timestampText = formatTimestamp(entry.timestamp) || '日時不明';
      div.innerHTML = `
        <strong>${timestampText}</strong><br>
        場所：${entry.locationName || 'N/A'}<br>
        評価：${entry.stars ? '★'.repeat(entry.stars) : '未評価'}<br>
        メモ：${entry.memo || '（メモなし）'}<br>
        カテゴリ：${entry.amount_category || "未設定"}<br>
        金額：¥${entry.amount !== null ? entry.amount : '---'}<br>
        <small>緯度：${latText}, 経度：${lngText}</small>
      `;
      div.addEventListener('click', () => beginEditLogEntry(doc.id, entry));
      logContainer.appendChild(div);
    });
  });
}
