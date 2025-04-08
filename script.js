// Firebase設定
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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const statusDiv = document.getElementById("status");

// Leaflet 地図初期化（とりあえず東京駅）
const map = L.map('map').setView([35.6812, 139.7671], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ログ全件取得＆表示
db.ref("logs")
  .orderByChild("timestamp")
  .on("value", async (snapshot) => {
    const logsObj = snapshot.val();
    if (!logsObj) {
      statusDiv.textContent = "データが存在しません。";
      return;
    }

    // 安全なログ配列を生成（timestamp, lat, lng 必須）
    const logs = Object.values(logsObj)
      .filter(log => log && log.timestamp && log.lat && log.lng)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (logs.length === 0) {
      statusDiv.textContent = "有効なログがありません。";
      return;
    }

    const latlngs = [];

    logs.forEach(log => {
      const { lat, lng, tag, timestamp } = log;
      const jstTime = new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      L.marker([lat, lng]).addTo(map)
        .bindPopup(`${tag}<br>${jstTime}`);
      latlngs.push([lat, lng]);
    });

    // 経路線＋矢印表示
    if (latlngs.length > 1) {
      const polyline = L.polyline(latlngs, { color: 'blue' }).addTo(map);

      L.polylineDecorator(polyline, {
        patterns: [
          {
            offset: '5%',
            repeat: '10%',
            symbol: L.Symbol.arrowHead({
              pixelSize: 8,
              polygon: false,
              pathOptions: { stroke: true, color: 'blue' }
            })
          }
        ]
      }).addTo(map);
    }

    // 最新地点の情報
    const latest = logs[logs.length - 1];
    const { lat, lng, tag, timestamp } = latest;
    const jstTime = new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

    // 中心を最新地点に移動
    map.setView([lat, lng], 15);

    // 住所取得（Nominatim）
    let addressText = "取得中...";
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await res.json();
      addressText = data.display_name || "住所取得失敗";
    } catch (e) {
      addressText = "住所取得エラー";
    }

    // ステータス表示
    statusDiv.innerHTML = `
      ✅ 最新ログ取得！<br>
      アプリ名：${tag}<br>
      緯度：${lat}<br>
      経度：${lng}<br>
      時刻（日本時間）：${jstTime}<br>
      住所：${addressText}
    `;
  });