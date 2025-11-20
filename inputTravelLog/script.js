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
const categoriesCollectionRef = db.collection("categories");

const PLAYER_STATUS_FIELDS = ["level", "hp", "mp", "gold", "condition"];
const PLAYER_STATUS_DEFAULTS = {
  level: "",
  hp: "",
  mp: "",
  gold: "",
  condition: ""
};
const DEFAULT_CATEGORIES = [
  { name: "食費", color: "#e74c3c" },
  { name: "交通費", color: "#3498db" },
  { name: "作業", color: "#2ecc71" },
  { name: "温泉", color: "#e67e22" },
  { name: "観光費", color: "#9b59b6" },
  { name: "買い物", color: "#ff1493" },
  { name: "宿泊費", color: "#1abc9c" },
  { name: "その他", color: "#bdc3c7" },
  { name: "起床", color: "#fffb96" },
  { name: "就寝", color: "#6c5ce7" },
  { name: "給油", color: "#f1c40f" }
];
const DEFAULT_CATEGORY_MAP = DEFAULT_CATEGORIES.reduce((map, item) => {
  map[item.name] = item.color;
  return map;
}, {});

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
const ratingToStars = (value) => {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return "";
  return "★".repeat(Math.min(5, count));
};

const starsToValue = (value) => {
  if (typeof value === "string") {
    const starsOnly = value.replace(/[^★]/g, "");
    return starsOnly.length > 0 ? starsOnly.length : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};
const presetWakeBtn = document.getElementById('presetWake');
const presetSleepBtn = document.getElementById('presetSleep');
const presetFuelBtn = document.getElementById('presetFuel');
const clearRatingBtn = document.getElementById('clearRatingBtn');
const categoryManagerSection = document.getElementById('category-manager');
const categoryForm = document.getElementById('categoryForm');
const categoryNameInput = document.getElementById('categoryNameInput');
const categoryColorInput = document.getElementById('categoryColorInput');
const categoryCancelEditBtn = document.getElementById('categoryCancelEdit');
const categoriesListEl = document.getElementById('categoriesList');

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
let unsubscribeCategories = null;
let categoriesData = [];
let editingCategoryId = null;
let categoriesSeeded = false;

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

const ensureLocationReady = () => {
  if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) {
    alert("位置情報の取得を待ってから利用してください。");
    return false;
  }
  return true;
};

const submitQuickLog = async ({ locationName, memo = "", category, amount = null, rating = null, successMessage }) => {
  if (!locationName || !category) {
    alert("ログ情報が不足しています。");
    return;
  }
  if (!ensureLocationReady()) return;
  const data = {
    stars: ratingToStars(rating) || null,
    locationName,
    memo,
    amount_category: category,
    amount: amount === null || amount === "" ? null : Number(amount),
    lat: currentLat,
    lng: currentLng,
    timestamp: new Date().toISOString()
  };
  try {
    await db.collection("logs").add(data);
    alert(successMessage || "送信完了！");
  } catch (error) {
    alert("送信に失敗しました: " + error.message);
  }
};

const getEffectiveCategories = () => (categoriesData.length ? categoriesData : DEFAULT_CATEGORIES);

const populateCategorySelectOptions = () => {
  if (!categorySelect) return;
  const previous = categorySelect.value;
  categorySelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.textContent = "カテゴリを選択";
  if (!previous) placeholder.selected = true;
  categorySelect.appendChild(placeholder);
  const names = getEffectiveCategories().map(cat => cat.name);
  names.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    if (previous && previous === name) option.selected = true;
    categorySelect.appendChild(option);
  });
  if (previous && !names.includes(previous)) {
    categorySelect.selectedIndex = 0;
  }
};

const renderCategoryList = () => {
  if (!categoriesListEl) return;
  const categories = getEffectiveCategories();
  if (!categories.length) {
    categoriesListEl.innerHTML = "<li>カテゴリがありません。</li>";
    return;
  }
  categoriesListEl.innerHTML = "";
  categories.forEach(cat => {
    const li = document.createElement("li");
    const info = document.createElement("div");
    info.className = "category-info";
    const swatch = document.createElement("span");
    swatch.className = "category-color-swatch";
    swatch.style.background = cat.color || DEFAULT_CATEGORY_MAP[cat.name] || "#cccccc";
    const label = document.createElement("span");
    label.textContent = cat.name;
    info.appendChild(swatch);
    info.appendChild(label);
    li.appendChild(info);
    const docId = cat.id || cat.name;
    if (docId) {
      const actions = document.createElement("div");
      actions.className = "category-actions";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "編集";
      editBtn.addEventListener("click", () => startCategoryEdit({ ...cat, id: docId }));
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = "削除";
      deleteBtn.addEventListener("click", () => handleCategoryDelete({ ...cat, id: docId }));
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      li.appendChild(actions);
    }
    categoriesListEl.appendChild(li);
  });
};

const startCategoryEdit = (cat) => {
  editingCategoryId = cat.id || cat.name;
  if (categoryNameInput) categoryNameInput.value = cat.name || "";
  if (categoryColorInput) categoryColorInput.value = cat.color || DEFAULT_CATEGORY_MAP[cat.name] || "#ffcc00";
  const saveBtn = document.getElementById("categorySaveBtn");
  if (saveBtn) saveBtn.textContent = "カテゴリを更新";
  if (categoryManagerSection) {
    categoryManagerSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};

const resetCategoryForm = () => {
  editingCategoryId = null;
  if (categoryForm) {
    categoryForm.reset();
  }
  if (categoryColorInput) categoryColorInput.value = "#ffcc00";
  const saveBtn = document.getElementById("categorySaveBtn");
  if (saveBtn) saveBtn.textContent = "カテゴリを保存";
};

const handleCategoryDelete = (cat) => {
  const docId = cat.id || cat.name;
  if (!docId) return;
  if (!confirm(`${cat.name} を削除しますか？`)) return;
  categoriesCollectionRef.doc(docId).delete().catch(error => {
    alert("削除に失敗しました: " + error.message);
  });
};

const seedDefaultCategories = async () => {
  const batch = db.batch();
  DEFAULT_CATEGORIES.forEach(cat => {
    const docRef = categoriesCollectionRef.doc(cat.name);
    batch.set(docRef, { name: cat.name, color: cat.color }, { merge: true });
  });
  try {
    await batch.commit();
  } catch (error) {
    console.error("カテゴリ初期化に失敗しました:", error);
  }
};

const subscribeCategories = () => {
  if (!categoryManagerSection || unsubscribeCategories) return;
  unsubscribeCategories = categoriesCollectionRef.orderBy("name").onSnapshot(async snapshot => {
    if (snapshot.empty) {
      if (!categoriesSeeded) {
        categoriesSeeded = true;
        await seedDefaultCategories();
      }
      categoriesData = DEFAULT_CATEGORIES.map(cat => ({ ...cat, id: cat.name }));
    } else {
      categoriesData = snapshot.docs.map(doc => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          name: data.name || doc.id,
          color: data.color || DEFAULT_CATEGORY_MAP[data.name] || "#cccccc"
        };
      });
    }
    renderCategoryList();
    populateCategorySelectOptions();
  }, (error) => {
    if (categoriesListEl) {
      categoriesListEl.innerHTML = `<li>取得に失敗しました：${error.message}</li>`;
    }
  });
};

const teardownCategoriesSubscription = () => {
  if (typeof unsubscribeCategories === "function") {
    unsubscribeCategories();
  }
  unsubscribeCategories = null;
  categoriesData = [];
  resetCategoryForm();
  renderCategoryList();
  populateCategorySelectOptions();
};

renderCategoryList();
populateCategorySelectOptions();

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
  currentRating = starsToValue(entry.stars);
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
    teardownCategoriesSubscription();
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
  subscribeCategories();
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

  if (presetWakeBtn) {
    presetWakeBtn.addEventListener("click", () => {
      submitQuickLog({
        locationName: "起床",
        memo: "",
        category: "起床",
        successMessage: "起床ログを記録しました。"
      });
    });
  }

  if (presetSleepBtn) {
    presetSleepBtn.addEventListener("click", () => {
      const memo = prompt("就寝のメモを入力してください（任意）", "");
      if (memo === null) return;
      submitQuickLog({
        locationName: "就寝",
        memo: memo.trim(),
        category: "就寝",
        successMessage: "就寝ログを記録しました。"
      });
    });
  }

  if (presetFuelBtn) {
    presetFuelBtn.addEventListener("click", () => {
      const amountInput = prompt("給油金額（円）を入力してください", "");
      if (amountInput === null) return;
      const parsed = Number(amountInput);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        alert("正しい金額を入力してください。");
        return;
      }
      submitQuickLog({
        locationName: "給油",
        memo: "",
        category: "給油",
        amount: parsed,
        successMessage: "給油ログを記録しました。"
      });
    });
  }

  // Form Submission
  appForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const locationName = locationNameInput.value.trim() || "---";
    const memo = actionInput.value;
    const category = categorySelect.value;
    const amountValue = amountInputEl.value;
    const amount = amountValue === "" ? null : parseInt(amountValue, 10);

    if (!category) {
      alert("カテゴリは必須です。");
      return;
    }

    const isEditing = Boolean(editingLogId);
    const latToUse = isEditing ? (editingMetadata?.lat ?? currentLat) : currentLat;
    const lngToUse = isEditing ? (editingMetadata?.lng ?? currentLng) : currentLng;
    const timestampToUse = isEditing ? (editingMetadata?.timestamp ?? new Date().toISOString()) : new Date().toISOString();

    const data = {
      stars: ratingToStars(currentRating) || null,
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

  if (categoryForm && !categoryForm.dataset.initialized) {
    categoryForm.dataset.initialized = true;
    categoryForm.addEventListener("submit", handleCategorySubmit);
  }

  if (categoryCancelEditBtn && !categoryCancelEditBtn.dataset.bound) {
    categoryCancelEditBtn.dataset.bound = "true";
    categoryCancelEditBtn.addEventListener("click", resetCategoryForm);
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

async function handleCategorySubmit(event) {
  event.preventDefault();
  if (!auth.currentUser) {
    alert("カテゴリの追加・編集にはログインしてください。");
    return;
  }
  const name = categoryNameInput.value.trim();
  if (!name) {
    alert("カテゴリ名を入力してください。");
    return;
  }
  const color = categoryColorInput.value || "#ffcc00";
  const duplicate = categoriesData.some(cat => cat.name === name && cat.id !== editingCategoryId);
  if (duplicate) {
    alert("同名のカテゴリが既に存在します。");
    return;
  }
  const payload = { name, color };
  try {
    if (editingCategoryId) {
      await categoriesCollectionRef.doc(editingCategoryId).set(payload, { merge: true });
      alert("カテゴリを更新しました。");
    } else {
      await categoriesCollectionRef.add({
        ...payload,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert("カテゴリを追加しました。");
    }
    resetCategoryForm();
  } catch (error) {
    alert("カテゴリの保存に失敗しました: " + error.message);
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
      const ratingText = entry.stars ? entry.stars : '未評価';
      div.innerHTML = `
        <strong>${timestampText}</strong><br>
        場所：${entry.locationName || 'N/A'}<br>
        評価：${ratingText}<br>
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
