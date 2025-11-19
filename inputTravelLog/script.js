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

const createRateLimitedFetch = (intervalMs = 1500) => {
  let lastTime = 0;
  let queue = Promise.resolve();
  return (url, options) => {
    const run = queue.then(async () => {
      const elapsed = Date.now() - lastTime;
      const wait = Math.max(0, intervalMs - elapsed);
      if (wait) {
        await new Promise(resolve => setTimeout(resolve, wait));
      }
      lastTime = Date.now();
      return fetch(url, options);
    });
    queue = run.catch(() => {});
    return run;
  };
};

const rateLimitedNominatimFetch = createRateLimitedFetch(1500);

// --- DOM Elements ---
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const appForm = document.getElementById('appForm');
const statusEl = document.getElementById('status');
const logContainer = document.getElementById('logContainer');
const stars = document.querySelectorAll('.star-rating .star');
const locationSearchInput = document.getElementById('location-search');
const locationSearchBtn = document.getElementById('location-search-btn');
const locationResultsEl = document.getElementById('location-results');
const locationNameInput = document.getElementById('locationNameInput');
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

let currentRating = null;
let currentLat = null;
let currentLng = null;
let unsubscribePlayerStatus = null;
let unsubscribeBudgets = null;

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
    searchNearbyPlaces(null, currentLat, currentLng); // Auto-search on load
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
      currentRating = parseInt(star.dataset.value);
      stars.forEach(s => {
        s.classList.toggle('selected', parseInt(s.dataset.value) <= currentRating);
      });
    });
  });

  // Location Search
  locationSearchBtn.addEventListener('click', () => {
    const query = locationSearchInput.value;
    if (query && currentLat && currentLng) {
      searchNearbyPlaces(query, currentLat, currentLng);
    }
  });

  // Form Submission
  appForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const locationName = locationNameInput.value;
    const memo = document.getElementById("actionInput").value;
    const category = document.getElementById("categorySelect").value;
    const amountInput = document.getElementById("amountInput").value;
    const amount = amountInput === "" ? null : parseInt(amountInput);

    if (!locationName || !category) {
      alert("場所の名前とカテゴリは必須です。");
      return;
    }

    const data = {
      stars: currentRating,
      locationName: locationName,
      memo: memo,
      amount_category: category,
      amount: amount,
      lat: currentLat,
      lng: currentLng,
      timestamp: new Date().toISOString()
    };

    try {
      await db.collection('logs').add(data);
      alert("送信完了！");
      // Reset form
      appForm.reset();
      currentRating = null;
      stars.forEach(s => s.classList.remove('selected'));
      locationResultsEl.innerHTML = '';
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

// --- Location Search (Nominatim) ---
async function searchNearbyPlaces(query, lat, lng) {
  let url;
  if (query) {
    // Search with a query
    url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&viewbox=${lng-0.1},${lat-0.1},${lng+0.1},${lat+0.1}&bounded=1`;
  } else {
    // Reverse search for nearby POIs
    url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`;
  }
  
  try {
    const res = await rateLimitedNominatimFetch(url);
    const data = await res.json();
    
    let places = [];
    if (query && Array.isArray(data)) {
        places = data;
    } else if (!query && data.display_name) {
        // For reverse geocoding, we can suggest the main result and then search nearby
        places.push(data);
        // Let's also do a search for nearby amenities for more options
        const amenitiesRes = await rateLimitedNominatimFetch(`https://nominatim.openstreetmap.org/search?q=amenity&format=json&limit=10&viewbox=${lng-0.01},${lat-0.01},${lng+0.01},${lat+0.01}&bounded=1`);
        const amenitiesData = await amenitiesRes.json();
        places = places.concat(amenitiesData);
    }

    locationResultsEl.innerHTML = '';
    if (places.length > 0) {
      places.forEach(place => {
        const item = document.createElement('div');
        item.className = 'location-result-item';
        item.textContent = place.display_name;
        item.addEventListener('click', () => {
          locationNameInput.value = place.display_name.split(',')[0]; // Take the most relevant part of the name
          locationResultsEl.innerHTML = ''; // Hide results after selection
        });
        locationResultsEl.appendChild(item);
      });
    } else {
      locationResultsEl.textContent = '周辺に施設が見つかりません。';
    }
  } catch (e) {
    console.error("Location search failed", e);
    locationResultsEl.textContent = '場所の検索に失敗しました。';
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
      div.innerHTML = `
        <strong>${new Date(entry.timestamp).toLocaleString()}</strong><br>
        場所：${entry.locationName || 'N/A'}<br>
        評価：${entry.stars ? '★'.repeat(entry.stars) : '未評価'}<br>
        メモ：${entry.memo || '（メモなし）'}<br>
        カテゴリ：${entry.amount_category || "未設定"}<br>
        金額：¥${entry.amount !== null ? entry.amount : '---'}<br>
        <small>緯度：${entry.lat.toFixed(4)}, 経度：${entry.lng.toFixed(4)}</small>
      `;
      logContainer.appendChild(div);
    });
  });
}
