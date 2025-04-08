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

const map = L.map('map').setView([35.6812, 139.7671], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

db.ref("logs")
  .orderByChild("timestamp")
  .on("value", async (snapshot) => {
    const logsObj = snapshot.val();
    if (!logsObj) {
      statusDiv.textContent = "データが存在しません。";
      return;
    }

    const logs = Object.values(logsObj).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const latlngs = [];

    // 💰 金額集計用変数
    let total = 0, today = 0, thisWeek = 0, thisMonth = 0;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - todayStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    logs.forEach(log => {
      const { lat, lng, memo, timestamp, amount } = log;
      const label = memo || "（メモなし）";
      const jstTime = new Date(timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

      L.marker([lat, lng]).addTo(map)
        .bindPopup(`
          ${jstTime}<br>
          ${label}<br>
          ¥${amount}`);
      latlngs.push([lat, lng]);

      // 金額集計
      const t = new Date(timestamp);
      const amt = Number(amount) || 0;
      total += amt;
      if (t >= todayStart) today += amt;
      if (t >= weekStart) thisWeek += amt;
      if (t >= monthStart) thisMonth += amt;
    });

    // 経路線を表示
    if (latlngs.length > 1) {
      L.polyline(latlngs, { color: 'blue' }).addTo(map);
    }

    // 最新地点の情報
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

    statusDiv.innerHTML = `
      ℹ️竹原最新情報<br>
      時刻：${jstTime}<br>
      住所：${addressText}<br>
      メモ：${memo}<br>
      出費：¥${amount}
    `;

    // 💰 金額表示更新
    document.getElementById("amountStats").innerHTML = `
      📅 今日：¥${today}<br>
      📅 今週：¥${thisWeek}<br>
      📅 今月：¥${thisMonth}<br>
      💰使用金額 合計：¥${total}
    `;
  });
