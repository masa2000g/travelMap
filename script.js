
// Firebase の初期設定
const firebaseConfig = {
  apiKey: "AIzaSyBtUbgKYgFwrQmES7rmZSCN0TaAV3aPKKI",
  authDomain: "sharetravelinfolikedq.firebaseapp.com",
  databaseURL: "https://sharetravelinfolikedq-default-rtdb.firebaseio.com",
  projectId: "sharetravelinfolikedq",
  storageBucket: "sharetravelinfolikedq.firebasestorage.app",
  messagingSenderId: "460046576435",
  appId: "1:460046576435:web:456ee14f8b271cf2caac46",
  measurementId: "G-5YLQ4QLZDV"
};

// Firebase アプリを初期化し、Realtime Database を取得
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 表示用のステータス領域取得
const statusDiv = document.getElementById("status");

// 地図の初期化（東京駅を中心に設定）
const map = L.map('map').setView([35.6812, 139.7671], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// カテゴリ設定（色とピンアイコンをカテゴリ名で管理）
const CATEGORY_SETTINGS = {
  食費: {
    color: 'red',
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png'
  },
  交通費: {
    color: 'blue',
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png'
  },
  作業: {
    color: 'green',
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png'
  },
  その他: {
    color: 'gray',
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png'
  }
};

// カテゴリ別のピンアイコン（最新地点用）を生成
const iconsLarge = {};
for (const key in CATEGORY_SETTINGS) {
  iconsLarge[key] = L.icon({
    iconUrl: CATEGORY_SETTINGS[key].iconUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
  });
}

// Firebase Realtime Database からログデータを取得し処理
db.ref("logs").orderByChild("timestamp").on("value", async (snapshot) => {
  const logsObj = snapshot.val();
  if (!logsObj) {
    statusDiv.textContent = "データが存在しません。";
    return;
  }

  // タイムスタンプ順に並べ替えたログ配列
  const logs = Object.values(logsObj).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const latlngs = []; // 線描画用の位置配列
  const nodeMarkers = []; // ノードとして追加する旧地点

  // 金額集計用の変数
  let total = 0, today = 0, thisWeek = 0, thisMonth = 0;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - todayStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // すべてのログをループ
  logs.forEach((log, index) => {
    const { lat, lng, memo = "", amount = 0, timestamp, amount_category = "その他" } = log;
    const jstTime = new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    const category = CATEGORY_SETTINGS[amount_category] ? amount_category : "その他";
    const isLatest = (index === logs.length - 1);

    if (isLatest) {
      // 最新地点：ピンを使って表示
      const marker = L.marker([lat, lng], {
        icon: iconsLarge[category]
      }).addTo(map);
      marker.bindPopup(`${jstTime}<br>${memo || "（メモなし）"}<br>¥${amount}`);
    } else {
      // 旧地点：ノード（円）として記録。描画はあとで一括で行う
      const circle = L.circleMarker([lat, lng], {
        radius: 4,
        fillColor: CATEGORY_SETTINGS[category].color,
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      }).bindPopup(`${jstTime}<br>${memo || "（メモなし）"}<br>¥${amount}`);
      nodeMarkers.push(circle);
    }

    latlngs.push([lat, lng]);

    // 金額集計（今日・今週・今月）
    const t = new Date(timestamp);
    const amt = Number(amount) || 0;
    total += amt;
    if (t >= todayStart) today += amt;
    if (t >= weekStart) thisWeek += amt;
    if (t >= monthStart) thisMonth += amt;
  });

  // 経路線を描画（前面にノードを描くため先に追加）
  if (latlngs.length > 1) {
    L.polyline(latlngs, {
      color: 'blue',
      weight: 4,           // 太さ
      opacity: 0.6,        // 透明度
      dashArray: '6, 8',   // 破線（6px 線 + 8px 間隔）
      lineCap: 'round',    // 丸みのある線端
      lineJoin: 'round'    // 丸みのある交差
    }).addTo(map);
  }

  // ノードを最後に一括追加して前面に表示
  nodeMarkers.forEach(marker => marker.addTo(map));

  // 最新地点の地図フォーカスと住所取得
  const latest = logs[logs.length - 1];
  const { lat, lng, memo, amount, timestamp } = latest;
  const jstTime = new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  map.setView([lat, lng], 10);

  let addressText = "取得中...";
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
    const data = await res.json();
    addressText = data.display_name || "住所取得失敗";
  } catch (e) {
    addressText = "住所取得エラー";
  }

  // 情報表示の更新
  document.getElementById("status").innerHTML = `
    ℹ️最新情報<br>
    時刻：${jstTime}<br>
    住所：${addressText}<br>
    メモ：${memo}<br>
    出費：¥${amount}
  `;

  document.getElementById("amountStats").innerHTML = `
    📅 今日：¥${today}<br>
    📅 今週：¥${thisWeek}<br>
    📅 今月：¥${thisMonth}<br>
    💰使用金額 合計：¥${total}
  `;
});

const legend = L.control({ position: 'bottomright' });  // 右下に表示

legend.onAdd = function (map) {
  const div = L.DomUtil.create('div', 'info legend');
  div.style.background = 'white';
  div.style.padding = '6px';
  div.style.borderRadius = '5px';
  div.style.boxShadow = '0 0 6px rgba(0,0,0,0.3)';
  div.innerHTML += '<b>カテゴリ凡例</b><br>';

  for (const key in CATEGORY_SETTINGS) {
    const color = CATEGORY_SETTINGS[key].color;
    div.innerHTML +=
      `<i style="background:${color}; width:12px; height:12px; display:inline-block; margin-right:6px;"></i> ${key}<br>`;
  }

  return div;
};

legend.addTo(map);