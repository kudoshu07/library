# コメント機能 + メルマガ拡張 要件定義

最終更新: 2026-05-05
ステータス: ドラフト v2（マージ済みメルマガ機能を反映）

---

## 1. 背景と目的

Kudo Shu Library のブログ記事に Twitter ライクなコメント機能を追加する。
読者からのフィードバックを受けやすくし、コミュニティ的な対話の場をブログに持たせる。

コメント機能には投稿者の身元を担保する仕組みが必要となる。本スコープでは、
直近マージされた **メルマガ機能（PR #1, commit 9677fb6）** をベースにし、

- メルマガ登録に **ユーザー名（表示名）** を加える拡張
- メルマガ登録者向けの **マジックリンクログイン基盤** の追加
- ブログ記事への **コメント / 返信 / いいね** 機能

の 3 点を一括で構築する。

---

## 2. 既存メルマガ機能（前提）

要件定義の前提として、現状（main ブランチ）のメルマガ実装を整理する。

| 観点 | 現状 |
|---|---|
| ストレージ | **Supabase (Postgres)**（[supabase/migrations/0001_newsletter.sql](supabase/migrations/0001_newsletter.sql)） |
| メール送信 | **Resend**（[lib/newsletter.ts](lib/newsletter.ts)） |
| 登録フロー | ダブルオプトイン（メール入力 → 確認メール送信 → リンククリックで `confirmed=true`） |
| 既存テーブル | `subscribers` (id, email, sources[], confirmed, confirm_token, unsubscribe_token, ...), `notifications_log` |
| 配信トリガ | `scripts/notify-new-content.mjs`（GitHub Actions 想定）→ 新着コンテンツを Resend で配信 |
| 解除フロー | 配信メール内のリンクで `unsubscribed_at` を更新 |
| ログイン / セッション | **存在しない**（confirm_token / unsubscribe_token はワンタイム用途のみ） |
| 表示名 | **未対応**（本スコープで追加） |
| フィーチャーフラグ | `ENABLE_SUBSCRIBE_UI`（main で `true` に切替済み） |

本コメント機能の認証は、既存の confirm_token を流用するのではなく、
**別途マジックリンクログインフロー**を追加する形で構築する。
（confirm_token は 1 回使用したら expire するため、コメント投稿のたびに認証する用途には不向き）

---

## 3. スコープ

### 3.1 含まれるもの

**メルマガ機能の拡張**
- `subscribers` への **表示名 (display_name)** カラム追加
- 登録フォームに表示名フィールド追加
- 確認メール本文に表示名を反映
- プロフィール画面での表示名変更

**コメント認証基盤**
- メルマガ登録者向けマジックリンクログイン
- ログインセッション（Cookie）の発行・保持
- 既存購読者がログイン時、その場で表示名を未設定なら入力させるフォールバック

**コメント機能（ブログ記事のみ）**
- コメント投稿・閲覧
- 返信（1 階層、計 2 階層スレッド）
- コメントへのいいね
- 投稿者によるコメントの編集・削除
- オーナーによるコメント削除・ユーザー BAN
- 自分のコメントへの返信メール通知（デフォルト ON、OFF 可）
- 投稿レートリミット
- 退会機能とそれに伴うコメント削除

### 3.2 含まれないもの（将来スコープ）

- ブログ以外（note, Instagram, Podcast）へのコメント
- コメントの全文検索・モデレーション AI
- 事前承認制モデレーション
- ハンドル名（@id）・メンション機能
- 画像・絵文字リアクション・装飾テキスト（Markdown 等）
- 多階層スレッド（2 階層を超える返信）
- Gravatar / SNS アバター連携

---

## 4. ユーザーストーリー

### 4.1 読者（未登録）
- 訪問するだけでブログ記事のコメントは閲覧できる
- 投稿しようとするとメルマガ登録への導線が表示される

### 4.2 読者（メルマガ登録済み・未ログイン）
- ブラウザに有効セッションがない場合、コメント投稿時にメール入力 → マジックリンク要求
- リンククリック後、自動的にコメント投稿フォームに戻り、内容を維持したまま投稿可能

### 4.3 読者（メルマガ登録済み・ログイン中）
- 記事下のコメント欄から投稿できる
- 既存コメントに返信できる（1 階層まで）
- コメントに「いいね」を付けられる
- 自分のコメントを後から編集・削除できる
- 自分のコメントに返信が付くとメールで通知が届く（OFF 可）
- プロフィール画面から表示名変更・通知設定変更・退会ができる

### 4.4 オーナー（工藤さん）
- 不適切なコメントを削除できる
- 不適切な投稿を繰り返すユーザーを BAN できる（メールアドレス単位）
- 簡易管理画面で BAN リストを確認・解除できる

---

## 5. 機能要件

### 5.1 メルマガ登録の拡張（表示名）

| 項目 | 内容 |
|---|---|
| 追加カラム | `subscribers.display_name text` |
| 必須性 | **新規登録時 必須** |
| 既存購読者 | NULL を許容。マジックリンクログイン後にコメント投稿しようとした際に未設定であれば入力を強制 |
| 文字数 | 1〜30 文字（仮置き） |
| 一意性 | **不要**（同名の表示名を許容） |
| 変更 | プロフィール画面から変更可能 |
| 表示先 | コメント、返信、確認メール本文（「○○ さん、登録ありがとうございます」相当） |
| バリデーション | 改行・タブ・前後空白を除去。絵文字は許容 |

### 5.2 マジックリンクログイン（新規）

メルマガの `confirm_token` とは独立した、**繰り返し利用可能なログイン用トークン**を新設する。

| 項目 | 内容 |
|---|---|
| 新規テーブル | `login_tokens` (id, subscriber_id, token, expires_at, used_at, created_at) |
| トークン有効期限 | 15 分（仮置き） |
| ワンタイム性 | 1 回使用したら `used_at` を埋めて以後無効 |
| 認証対象 | `subscribers.confirmed = true AND unsubscribed_at IS NULL` のレコードのみ |
| セッション | 別テーブル `sessions` (id, subscriber_id, token, expires_at, created_at)。Cookie に `token` を保存 |
| Cookie 属性 | `HttpOnly` / `Secure` / `SameSite=Lax` |
| セッション有効期限 | 90 日（ローリング更新、仮置き） |
| 未登録メールでログイン要求 | 「このメールアドレスはメルマガに登録されていません」と表示し、登録フォームへ誘導 |

ログイン用メールは Resend で送信。`lib/newsletter.ts` のテンプレート関数を拡張して `renderLoginEmail` を追加する。

### 5.3 コメント投稿

| 項目 | 内容 |
|---|---|
| 投稿可能ユーザー | `confirmed=true` AND `unsubscribed_at IS NULL` AND BAN されていない AND ログイン済み |
| 本文 | プレーンテキスト（改行のみ） |
| 文字数上限 | 1,000 文字（仮置き） |
| URL の扱い | `http(s)://` で始まる文字列を自動でリンク化。`rel="nofollow noopener"` 付与 |
| 画像 / 装飾 | 不可 |
| 表示名 | 投稿時点ではなく、表示時に `subscribers.display_name` を JOIN（変更が反映される） |
| 投稿時の処理 | サーバ側でサニタイズ → 保存 → 親コメント投稿者へ通知メール送信（返信時のみ、設定で ON のユーザーのみ） |

### 5.4 返信（スレッド）

| 項目 | 内容 |
|---|---|
| ネスト深さ | 記事 → コメント → 返信 の **2 階層固定**。返信に対する返信は不可 |
| UI | 親コメントの下にインデントで返信を表示。Twitter の会話表示と同様 |

### 5.5 編集 / 削除

| 操作 | 投稿者本人 | オーナー | 第三者 |
|---|---|---|---|
| 編集 | ○ | × | × |
| 削除 | ○ | ○ | × |

- 編集時は「（編集済み）」バッジを表示
- 削除されたコメントは物理削除
- 親コメント削除時、返信は残す（「削除されたコメント」プレースホルダで文脈保持）

### 5.6 いいね

- メルマガ登録 + ログイン済みユーザーのみ実行可能
- ユーザー単位で重複防止（同一ユーザーの 2 回目は解除）
- いいね数を表示
- 並び順への影響はなし（古い順を維持）

### 5.7 表示・並び順

| 項目 | 内容 |
|---|---|
| 並び順 | 古い順 |
| ページネーション | 初期リリースは全件表示 |
| 表示位置 | 記事本文下、関連記事より上 |
| 投稿フォーム位置 | コメントリストの上端（未ログイン時はリスト下にメルマガ登録 CTA + ログイン CTA） |

### 5.8 通知

| トリガー | 通知方法 | デフォルト |
|---|---|---|
| メルマガ登録確認 | メール（既存） | 必須 |
| マジックリンク発行 | メール（新規） | 必須 |
| 自分のコメントに返信が付いた | メール（新規） | ON（設定で OFF 可） |
| 自分のコメントにいいねが付いた | なし | （初期リリースでは未対応） |
| 新着コンテンツ配信 | メール（既存） | ソース選択どおり（既存挙動） |

- 返信通知メールには「通知を OFF にする」ワンクリックリンクを付与
- 通知設定は購読者プロフィール画面で変更可能

### 5.9 モデレーション（オーナー専用）

| 機能 | 内容 |
|---|---|
| コメント削除 | 任意のコメントを削除（記事ページ上から削除ボタン or 管理画面） |
| ユーザー BAN | メールアドレス単位で投稿不可化。BAN 後は新規投稿・いいねを拒否、既存コメントは保持 |
| BAN 解除 | 管理画面から解除可能 |
| アクセス制御 | オーナー判定は環境変数 `OWNER_EMAIL` との一致で行う |

### 5.10 退会

- プロフィール画面から退会可能
- 退会時、`subscribers.unsubscribed_at` を更新（既存挙動）
- 加えて、当該ユーザーのコメントといいねを **すべて削除**（カスケード削除）
- 退会済みメールアドレスでの再登録は許可（既存挙動と同じく `confirmed=false` に戻す）

### 5.11 スパム対策

- 1 ユーザーあたり 1 分間に 5 件まで投稿可能（仮置き）
- マジックリンク発行も 1 メールアドレスあたり 1 分に 3 通までに制限
- NG ワード / Captcha は **初期リリース範囲外**

---

## 6. 非機能要件

### 6.1 ストレージ

すべて **Supabase (Postgres)** に集約する（既存メルマガ実装と整合）。

新規追加 / 変更:

```sql
-- 既存テーブルへのカラム追加
alter table public.subscribers
  add column display_name text;
alter table public.subscribers
  add column notify_on_reply boolean not null default true;
alter table public.subscribers
  add column banned boolean not null default false;
alter table public.subscribers
  add column banned_at timestamptz;

-- 新規テーブル
create table public.login_tokens (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,                                  -- e.g. "/2025/05/05/some-slug"
  parent_id uuid references public.comments(id) on delete cascade,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  -- ネスト深さ 2 階層を DB 制約で担保するため、parent_id の親が NULL であることを
  -- アプリ層 or トリガで強制する（運用案: API 層でチェック）
  check (length(body) <= 1000)
);

create index on public.comments (post_id, created_at);
create index on public.comments (subscriber_id);

create table public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, subscriber_id)
);
```

RLS は既存メルマガと同様に **deny all** とし、Next.js API ルートが `SUPABASE_SERVICE_ROLE_KEY` でアクセスする。

### 6.2 メール送信

- 既存 Resend インフラを再利用（環境変数 `RESEND_API_KEY`, `NEWSLETTER_FROM_EMAIL`, `NEWSLETTER_REPLY_TO`）
- 既存 [lib/newsletter.ts](lib/newsletter.ts) を拡張し、以下を追加:
  - `renderLoginEmail` — マジックリンク
  - `renderReplyNotificationEmail` — 返信通知
- 送信失敗時はサーバログに記録、ユーザーへの致命表示は最小限

### 6.3 デザイン / UI

- Twitter ライク、既存サイトのデザイントークン（Tailwind, shadcn/ui）を踏襲
- アバター: 表示名の頭文字 + 表示名から決定的に生成した背景色
- タイムスタンプ: 相対表示（「3 分前」「2 日前」）
- レスポンシブ対応必須（モバイルファースト）
- ダークモード対応（既存 next-themes に準拠）

### 6.4 アクセシビリティ

- フォーム要素に適切なラベル / aria 属性を付与
- キーボードのみで投稿・返信・いいね・削除が完了できる

### 6.5 セキュリティ

- 投稿時の本文は HTML エスケープ + サーバ側サニタイズ
- セッション Cookie は `HttpOnly` `Secure` `SameSite=Lax`
- マジックリンクトークンはワンタイム + 期限付き
- BAN 判定 / ログイン状態判定は **サーバ側で必ず実行**
- Supabase は service role key 経由のみ（RLS deny all 既存方針を踏襲）

### 6.6 プライバシー / 法的要件

- メールアドレス + 表示名を保管することへの同意チェックボックスを登録フォームに追加
- プライバシーポリシーへのリンク必須
- 退会時のデータ削除を明示

---

## 7. 画面一覧

| 画面 | パス | 概要 | 状態 |
|---|---|---|---|
| 購読登録 | `/subscribe` | **表示名フィールドを追加** | 既存改修 |
| 確認メール待ち | `/subscribe/check-email` 相当 | 確認メール送信完了画面 | 既存（confirmation_sent ステータス）|
| 確認完了 | `/subscribe/confirmed` | 確認リンク到達後のランディング | 既存 |
| 退会完了 | `/subscribe/unsubscribed` | 退会完了画面 | 既存 |
| ログイン要求 | `/login` | メール入力 → マジックリンク送信 | **新規** |
| ログイン検証 | `/api/auth/verify?token=...` | トークン検証 → セッション発行 → リダイレクト | **新規** |
| プロフィール | `/account` | 表示名変更、通知設定、退会 | **新規** |
| 管理画面 | `/admin/comments` | オーナーのみアクセス可。コメント一覧と削除、BAN 管理 | **新規** |
| ブログ記事 | `/[year]/[month]/[day]/[slug]` | 末尾にコメントセクションを追加 | 既存改修 |

---

## 8. API 一覧

| 経路 | メソッド | 概要 | 状態 |
|---|---|---|---|
| `/api/subscribe` | POST | 購読登録（**display_name を必須化**） | 既存改修 |
| `/api/subscribe/confirm` | GET | 確認トークン検証 | 既存 |
| `/api/subscribe/unsubscribe` | GET / POST | 配信停止 | 既存 |
| `/api/auth/login` | POST | マジックリンクメール送信 | **新規** |
| `/api/auth/verify` | GET | マジックリンク検証 → Cookie 発行 | **新規** |
| `/api/auth/logout` | POST | セッション破棄 | **新規** |
| `/api/account/profile` | PATCH | 表示名・通知設定の更新 | **新規** |
| `/api/account/unsubscribe` | POST | プロフィール画面からの退会 | **新規** |
| `/api/comments` | GET | 記事 ID 指定でコメント取得 | **新規** |
| `/api/comments` | POST | コメント・返信投稿 | **新規** |
| `/api/comments/[id]` | PATCH / DELETE | 編集 / 削除 | **新規** |
| `/api/comments/[id]/like` | POST / DELETE | いいね / 解除 | **新規** |
| `/api/admin/comments/[id]` | DELETE | オーナーによる削除 | **新規** |
| `/api/admin/ban` | POST / DELETE | BAN 管理 | **新規** |

---

## 9. リリース計画

- フェーズ分けせず **一括リリース**
- リリース判定基準:
  - 表示名つきメルマガ登録 → 確認 → ログイン → コメント投稿 → 返信 → いいね → 編集 → 削除 → 退会、のフルフローが本番環境で動作
  - オーナー BAN フローが動作
  - 主要ブラウザ（Chrome, Safari, モバイル Safari）で UI が破綻しない
  - Supabase マイグレーション (`0002_comments.sql` 想定) が冪等に適用できる

---

## 10. オープン項目（設計フェーズで詰める）

- マジックリンクおよびセッションの有効期限の最終決定
- 投稿レートリミットの具体値
- 表示名の文字数上限（1〜30 で適切か）
- 既存購読者（display_name = NULL）のフォールバック UI 詳細
- 削除されたコメントのプレースホルダ文言
- 管理画面の最低限機能の境界線（BAN 解除 UI まで初期リリースに含めるか）
- 退会時のコメント削除を即時実行か、ジョブ化するか
- 既存 `confirm_token` をログインにも流用しない方針の最終確認（→ 別途 `login_tokens` テーブル）

---

## 11. 既存コードへの影響まとめ

| ファイル | 改修内容 |
|---|---|
| [supabase/migrations/0001_newsletter.sql](supabase/migrations/0001_newsletter.sql) | 変更なし（新規マイグレーション `0002_comments.sql` で追加） |
| [lib/newsletter.ts](lib/newsletter.ts) | `renderLoginEmail`, `renderReplyNotificationEmail` を追加。`SUBSCRIBABLE_SOURCES` 等は流用 |
| [app/api/subscribe/route.ts](app/api/subscribe/route.ts) | `display_name` を `payloadSchema` に追加、insert/update 両方に反映 |
| [components/subscribe-form.tsx](components/subscribe-form.tsx) | 表示名フィールドを追加、状態と送信ペイロードに反映 |
| [app/subscribe/page.tsx](app/subscribe/page.tsx) | 必要に応じて見出し / 説明文を調整 |
| `.env.example` | 追加環境変数なし（Supabase / Resend は既設） |
