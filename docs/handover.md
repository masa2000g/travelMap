# 引き継ぎ書（travelMap）

## 1. 作業環境
- Node.js 18+ を推奨。`firebase-tools`（CLI）をグローバルインストール済みであること。
- リポジトリ直下で `npm install` を実行すると `firebase-admin` のみが入る。移行スクリプト以外はビルド不要。
- Firebase プロジェクト: `sharetravelinfolikedq`。Hosting ターゲットは `travelMap` と `inputTravelLog` の2つ。

## 2. ディレクトリ構成（抜粋）
- `travelMap/` … View アプリ本体。`index.html`/`style.css`/`script.js`。
- `inputTravelLog/` … 入力アプリ。`index.html`/`style.css`/`script.js`。
- `migration.js` … RTDB → Firestore 移行スクリプト。
- `travelMap/updateFirebase.js` … RTDB の `tag` → `memo` 変換などを行うブラウザスクリプト。
- `docs/` … 本書類（仕様書・引き継ぎ書）。
- `docs/implementation_history.md` … 直近の UI/機能変更をざっくり記録する履歴メモ。

## 3. デプロイ手順
1. Firebase CLI でログイン  
   ```bash
   firebase login --reauth  # 期限切れの場合
   ```
2. ルートディレクトリで対象をビルド（現状は静的ファイルのみなので不要）。
3. デプロイ  
   ```bash
   firebase deploy --only hosting:travelMap,hosting:inputTravelLog
   ```
4. 成功後、Firebase コンソールで Hosting の URL を確認。

> **注意**: 認証トークン失効時には `firebase deploy` が `Authentication Error` を返す。必ず `firebase login` を実行してからリトライする。

## 4. 運用上のポイント
- Firestore/RTDB ルールは既に公開読み＋認証書き込みに設定済み。ルール更新時は `firebase deploy --only firestore:rules` などで個別デプロイ可能。
- `serviceAccountKey.json` は移行スクリプト専用。安全な場所で管理し、Git には含めない。
- プレイヤーステータスは Firestore `meta/playerStatus` ドキュメントで共有している。`inputTravelLog` に追加したステータス編集UI（ログイン必須）から更新すると、`travelMap` 側の `window.updatePlayerStatus` に即座に反映される。
- 予算設定は Firestore `meta/budgets` ドキュメントで管理。`inputTravelLog` の「カテゴリ予算」フォームから編集し、`travelMap` の「予算」タブに残額/使用率が表示される。
- 出費統計ウィンドは Chart.js を用い、期間・カテゴリフィルタに応じて指標/カテゴリ内訳/棒グラフを再描画する。CDN 読み込みなのでネットワークが必要。
- 各フローティングウィンドはヘッダーをドラッグして移動可能。開くとデフォルト位置へ自動配置される。
- メインメニューとステータスは上部の枠に収め、子ウィンドウ（表示設定/出費関係/神託/出資）は常にその前面で表示される。モバイル縦向き時も 2×2 レイアウトを維持。
- Leaflet/Nominatim はネットワークアクセスを行うため、オフライン検証時はスタブが必要。
- ブラウザで `travelMap/updateFirebase.js` を開くと即処理が走るため、不要時は利用しない。

## 5. 未解決タスク / TODO
1. 神託/出資ウィンドのテキストや指標を更にゲーム性の高い演出へブラッシュアップ（例：クエスト進捗、メダル機能）。
2. プレイヤーステータスを複数スロットで管理する／履歴を残す機能の検討。
3. Nominatim のレスポンスを Firestore へキャッシュし、オフラインでも候補提示できるようにする。
4. Lint に加えてUIの自動テスト（Puppeteer 等）を導入し、主要フォーム送信フローを自動検証できるようにする。
5. CI/CD ワークフローで Staging 環境への自動デプロイや preview channel を活用する。
6. iPhone Safari で表示設定・統計プリセットが縦並びになる件と、モバイルでのウィンドウドラッグの体験を引き続き改善する。

## 6. トラブルシューティング
- **Leaflet 表示が崩れる**: `map.invalidateSize()` をロード後に実行しているが、DOM 構造を変えた場合には再呼び出しを検討。
- **Firestore の日時が表示されない**: `timestamp` が Firestore Timestamp 以外の形式の場合、`toJsDate` が `null` を返す。データ整形を確認。
- **Nominatim 逆引きが失敗**: API 制限または CORS。暫定メッセージ「住所取得エラー」が表示されるので、必要ならリトライ制御を実装。
- **`firebase deploy` 失敗**: 認証切れのほか、ターゲット名ミスに注意。`firebase target:list` で確認可能。

## 7. 連絡・備考
- Firebase プロジェクト権限を持つ Google アカウント情報を後任へ共有してください。
- 外部APIキー（Firebase Config）は `script.js` に直書きされている。公開サイトでも問題ない設定だが、リークリスクがあるため利用状況を監視すること。
- GitHub Actions（`.github/workflows/deploy.yml`）で `main` への push 時に lint → deploy を自動実行する。Firebase CLI の token を `FIREBASE_TOKEN` シークレットに登録しておくこと。
