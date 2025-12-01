# セキュリティチェックリスト

現状のリスクと運用タスクをまとめたチェックリストです。作業の完了状況に応じてチェックを更新してください。

## 即対応・確認事項
- [x] Realtime Database は使用しないため、`database.rules.json` を全面 deny（`.read/.write` ともに `false`）へ変更済み。
- [ ] Firebase Auth のパスワードポリシーを強化し、不要ユーザーを整理する。管理用アカウントには MFA を有効化。
- [ ] Firebase クライアント API キーの使用制限をコンソールで設定（許可ドメイン、アプリ識別）。
- [ ] 使用していない Firebase トークンや鍵は失効・削除する。

## 秘密情報の取り扱い
- [x] `serviceAccountKey.json` は `.gitignore` 済み。リポジトリ外に保管し、環境変数でパスを渡す運用にする（例: `SERVICE_ACCOUNT_PATH`）。
- [ ] 鍵のローテーション手順を決め、定期的に実施する（開発用と本番用を分離）。
- [ ] CI/CD を再開する場合、デプロイトークンは GitHub Secrets のみに置き、不要なトークンは失効する。

## リポジトリ衛生
- [x] エディタの一時ファイルを `.gitignore` に追加（`*~`, `*.swp`, `*.un~`）。
- [x] 不要な一時ファイル（`docs/.explain.html.un~`）を削除。
- [x] 秘密情報スキャンを導入（`scripts/secret-scan.sh` + `githooks/pre-commit`）。`git config core.hooksPath githooks` で有効化。

## 運用チェック
- [ ] ルール変更時は Firebase Emulator またはルールシミュレーターでテストする。
- [ ] デプロイ前後に監査ログ（Firebase/Cloud Logging）を確認し、不審なアクセスがないか確認する。
- [ ] セキュリティインシデント時の連絡先と手順をまとめる（連絡先/ロール、鍵失効、ユーザーへの通知方針）。

## 手順メモ
- サービスアカウントの扱い:
  - ローカルでは `SERVICE_ACCOUNT_PATH=/secure/path/serviceAccountKey.json` のように環境変数でパスを渡し、スクリプト側を `process.env.SERVICE_ACCOUNT_PATH` を読む形に改修する（`migration.js`/`check_logs.js` が対象）。
  - 開発用と本番用の鍵を分離し、不要になった鍵は失効させる。
- 鍵ローテーションの簡易手順:
  1. Firebase Console で新しいサービスアカウントキーを発行し、安全な場所に格納。
  2. `.env.local` などに新パスを設定して動作確認。
  3. 旧鍵を失効し、関係者にも破棄を周知。
- Firebase Auth 強化:
  - コンソールの Authentication > 設定 でパスワードポリシーを強化し、管理用アカウントに MFA を有効化。
  - 不要アカウントを削除し、権限を最小化。
- Firebase API キー制限:
  - Firebase Console で Web API キーの「アプリの制限」「API の制限」を設定し、許可ドメインを絞る。
- 秘密情報スキャン:
  - 付属スクリプト: `./scripts/secret-scan.sh`（`rg` が必要）。手動実行、または以下で pre-commit フックを有効化。
    - `git config core.hooksPath githooks`
    - `./scripts/secret-scan.sh` がコミット前に走り、疑わしい文字列があると失敗します。
  - git-secrets を使う場合（任意、ネットワーク環境で）:
    1. `brew install git-secrets` あるいは `git clone https://github.com/awslabs/git-secrets.git && sudo make install`。
    2. リポジトリで `git secrets --install && git secrets --register-aws --global` を実行。
    3. `git secrets --add 'AIza[0-9A-Za-z-_]+'` などでパターン追加。
    4. `githooks/pre-commit` 内で `git secrets --scan` を呼ぶように差し替えて運用することも可能。
- ルール変更の検証:
  - Firebase Emulator Suite で Firestore/RTDB ルールをテストし、`firebase emulators:start --only firestore` などで動作を確認。
  - 変更内容はルールシミュレーターのスクリーンショットや結果を残すと再検証しやすい。
