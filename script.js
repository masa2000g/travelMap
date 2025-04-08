// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// 最新の1件を取得
db.ref("logs")
  .orderByChild("timestamp")
  .limitToLast(1)
  .on("value", (snapshot) => {
    const logs = snapshot.val();
    if (!logs) {
      statusDiv.textContent = "データが存在しません。";
      return;
    }

    // 最新の1件を取り出す
    const latestKey = Object.keys(logs)[0];
    const latest = logs[latestKey];

    const { lat, lng, timestamp, tag } = latest;

    // 表示内容
    statusDiv.innerHTML = `
      ✅ 最新ログ取得！<br>
      アプリ名：${tag}<br>
      緯度：${lat}<br>
      経度：${lng}<br>
      時刻：${timestamp}
    `;

    // マップ更新
    map.setView([lat, lng], 15);
    if (window.currentMarker) map.removeLayer(window.currentMarker);

    window.currentMarker = L.marker([lat, lng]).addTo(map)
      .bindPopup(`${tag}<br>${timestamp}`).openPopup();
  });