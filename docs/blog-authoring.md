# Blog authoring (owner-only)

このドキュメントは、ブラウザから Notion 風エディタでブログを執筆・編集・公開する仕組みのセットアップ手順と運用ガイドです。
利用できるのは `OWNER_EMAIL` で指定されたメールアドレス（このリポジトリでは `shu.kudo@vcook.biz`）でログインしているユーザーのみです。

---

## 仕組みのざっくり全体像

- **下書き** は Supabase の `blog_drafts` テーブルに保存されます（容量節約のため autosave なし、手動「下書き保存」ボタン）。
- **公開** すると、下書きの内容が `content/blog/YYYY/MM/DD/{slug}.mdx` という MDX ファイルに書き出され、GitHub API 経由で `main` ブランチに直接コミットされます。Vercel が自動再デプロイし、1〜2 分でサイトに反映されます。
- **画像** は下書き中は **Supabase Storage**（`blog-draft-images` バケット）に保存され、エディタには即時表示されます（Vercelの再ビルド待ちなし）。**公開時に**、本文HTML中のStorage URLをスキャン → 画像を一括ダウンロード → `public/{slug}/{filename}` に MDX と同じ commit で GitHub にコミット → 本文の URL を `/{slug}/{filename}` に書き換え → Storage 上の元画像を削除。最終的なMDXは既存記事と同じローカルパス形式になります。
- **既存記事の編集** は「編集」ボタン → MDX を読み込んで下書き化 → 編集 → 公開で同じファイルに上書きコミット、という流れです。slug や日付を変えた場合は旧ファイル削除 + 新ファイル作成を 1 コミットで行います。

---

## 1. GitHub Personal Access Token (PAT) を作る

エディタから GitHub にコミットするために必要です。**Fine-grained PAT を強く推奨**します（権限を細かく絞れて安全）。

### 手順

1. https://github.com/settings/personal-access-tokens/new を開きます（GitHub にログインした状態で）。
2. **Token name**: `KSL blog editor` など分かりやすい名前を付けます。
3. **Expiration**: `Custom...` → 1 年後くらいに設定（短すぎると更新が頻繁、長すぎると漏洩リスク）。
4. **Resource owner**: `kudoshu07`（あなた個人）を選択。
5. **Repository access**: `Only select repositories` → `kudoshu07/library` を選択。
6. **Permissions** → `Repository permissions`:
   - **Contents**: `Read and write`
   - **Metadata**: `Read-only`（自動で付きます）
   - 他の権限は付与不要です。
7. ページ下部の `Generate token` をクリック。
8. 表示された `github_pat_xxxxxxxxxxxxxxxx` をコピー（**この画面を閉じると二度と表示されません**）。

### `.env.local` に追記

```bash
# Blog admin
OWNER_EMAIL=shu.kudo@vcook.biz
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxx
GITHUB_REPO=kudoshu07/library
GITHUB_BRANCH=main
```

**Vercel の本番環境**にも同じ環境変数を設定してください：

1. https://vercel.com/ → このプロジェクト → Settings → Environment Variables
2. 上記 4 つを `Production` / `Preview` / `Development` の全環境に追加
3. 設定後、一度 Redeploy が必要（変更を反映するため）

> ⚠️ **PAT が漏れたら即取り消し**: https://github.com/settings/personal-access-tokens で対象トークンの `Revoke` を押し、新しい PAT を発行して `.env.local` と Vercel を更新してください。

### PAT が期限切れになったら

- エディタから公開しようとした際にエラーが出ます。
- 上記の手順を再度実行して新しい PAT を作成し、`.env.local` と Vercel の環境変数を更新します。

---

## 2. Supabase マイグレーション

`supabase/migrations/0009_blog_drafts.sql` が `main` に push されると、`.github/workflows/supabase-migrations.yml` が自動で適用します。手動適用は不要です。

ローカル dev DB に適用したい場合のみ:

```bash
supabase db push
```

---

## 3. 使い方

### 新規ブログを書く

1. トップページ右上のヘッダーに `+ new` ボタンが表示されます（オーナーログイン時のみ）。
2. クリックすると `/admin/blog/new` → 空の下書きを作成 → エディタ画面 (`/admin/blog/drafts/{id}`) に遷移します。
3. 左カラム: タイトル / 公開日 / slug / 説明文 / カテゴリ (tags) / サムネイル画像
4. 右カラム: Notion 風の本文エディタ
   - `/` を打つとブロック挿入メニューが出ます
   - 画像はドラッグ&ドロップでアップロード可能（即 GitHub にコミット）
   - 太字 `Cmd/Ctrl+B`、引用、箇条書きなど Notion と同じショートカット
5. **下書き保存** ボタンで Supabase に保存（autosave なし）。
6. **プレビュー** ボタンで `/admin/blog/preview/{id}` を新しいタブで開き、公開後と同じレイアウトを確認できます。
7. **公開** ボタンで MDX ファイルを GitHub にコミット → Vercel デプロイ → 1〜2 分後にサイトに反映。
   - slug 重複チェックが走り、衝突したらエラーで弾かれます。
   - 成功すると下書きは自動削除され、公開記事 URL に遷移します。

### 既存記事を編集する

1. 公開記事ページの **タイトル直下右側** に小さく「編集」ボタンが表示されます（オーナーログイン時のみ）。
2. クリックすると MDX が下書きとしてインポートされ、エディタに遷移します。
3. 編集 → 公開で元のファイルに上書きコミット。
4. slug や公開日を変えると、**旧ファイル削除 + 新ファイル作成** が 1 コミットで実行されます。サイト内リンクや SNS 共有 URL が変わるので注意。

### 下書き一覧

- ヘッダーの `📝 draft` ボタン → `/admin/blog/drafts`
- 行をクリックすると編集画面
- 既存記事編集中の下書きには `📝 既存記事編集中` バッジが付きます

---

## 4. トラブルシューティング

| 症状 | 原因の可能性 | 対処 |
|---|---|---|
| `+ new` ボタンが出ない | ログインしていない / `OWNER_EMAIL` が違う | `/login` でログイン。env を確認 |
| 公開時に `unauthorized` | PAT 期限切れ or 取り消された | PAT 再発行（上記手順） |
| 公開時に `slug already exists` | 同じ年月日・slug の記事が既存 | slug か公開日を変更 |
| 公開後すぐサイトに反映されない | Vercel ビルド中 | 1〜2 分待つ。Vercel ダッシュボードでビルド状況を確認 |
| 画像が出ない | アップロード後すぐにデプロイ完了していない | Vercel ビルド完了を待つ |
| エディタが固まる | ローカルストレージに大きすぎる下書きがある | DevTools → Application → Local Storage で `ksl-blog-draft-*` を削除 |

---

## 5. アーキテクチャ参考

| ファイル/ディレクトリ | 役割 |
|---|---|
| `app/admin/blog/new/page.tsx` | 新規執筆エントリ |
| `app/admin/blog/drafts/page.tsx` | 下書き一覧 |
| `app/admin/blog/drafts/[id]/page.tsx` | エディタ |
| `app/admin/blog/preview/[id]/page.tsx` | プレビュー |
| `app/api/admin/blog/...` | drafts CRUD / publish / upload-image / import-from-mdx |
| `components/blog-editor/` | BlockNote ベースのエディタコンポーネント |
| `lib/admin-guard.ts` | `requireOwner()` ヘルパ |
| `lib/github-publisher.ts` | Octokit ラッパ（multi-file commit, image upload） |
| `lib/mdx-serializer.ts` | フロントマター + HTML → MDX / 逆変換 |
| `supabase/migrations/0009_blog_drafts.sql` | `blog_drafts` テーブル定義 |
