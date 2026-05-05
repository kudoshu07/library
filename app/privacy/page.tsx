import type { Metadata } from "next"
import Link from "next/link"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kudoshu07.com"

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "Kudo Shu Library における個人情報の収集・利用・管理についての方針です。",
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
}

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
      <header className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          プライバシーポリシー
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Kudo Shu Library（以下「当サイト」）が取り扱う個人情報の方針です。
        </p>
      </header>

      <div className="space-y-10 text-sm leading-relaxed text-foreground md:text-base">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight md:text-xl">
            1. 収集する情報
          </h2>
          <p>
            当サイトでは、(1) ニュースレター登録時にメールアドレス、(2)
            お問い合わせ・感想フォーム送信時にメールアドレス・任意のお名前・メッセージ本文を収集します。記事ページやタイムラインなどからフォームを開いた場合は、どのコンテンツから送信したか分かるよう、記事の識別子や外部コンテンツのIDを通知メールに含める場合があります。また不正利用の防止のため、お問い合わせ時に送信元のIPアドレスを通知メールに記録する場合があります。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight md:text-xl">
            2. 利用目的
          </h2>
          <p>収集した情報は、以下の目的に使用します：</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>新しい記事の公開通知（ニュースレター）</li>
            <li>月次ダイジェストの配信（ニュースレター）</li>
            <li>お問い合わせ・感想への対応・連絡</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight md:text-xl">
            3. 第三者提供
          </h2>
          <p>
            収集した個人情報をマーケティング目的で第三者に販売・提供することはありません。メールの送信処理には{" "}
            <a
              href="https://resend.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-accent"
            >
              Resend
            </a>{" "}
            を利用します。送信内容は当サイト運営者のメールボックスに届きます。Resend
            におけるデータの取り扱いは、同社のプライバシーポリシーに従います。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight md:text-xl">
            4. データ管理
          </h2>
          <p>
            お預かりした情報は適切なセキュリティ対策のもと管理します。ニュースレターは配信停止後に速やかにデータを削除します。お問い合わせの内容は当サイトのデータベースには保存せず、通知メールとして受信・保管します。
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight md:text-xl">
            5. ユーザーの権利
          </h2>
          <p>
            ニュースレターはメール内のリンクからいつでも配信を停止できます。お問い合わせ内容の開示・削除等については、受信したメールに記載の連絡先へご依頼ください。
          </p>
        </section>
      </div>

      <div className="mt-12 border-t border-border pt-6 text-sm">
        <Link
          href="/home"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  )
}
