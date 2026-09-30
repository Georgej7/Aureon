import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Aureon",
  description: "What information Aureon collects, how it's used, and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <section className="screen active" id="privacy">
      <div className="legal-page">
        <h1>Privacy Policy</h1>
        <p className="updated">Last updated: September 30, 2026</p>

        <p>
          This Privacy Policy explains what information Aureon (&quot;we&quot;, &quot;us&quot;)
          collects, how we use it, and the choices you have. By using Aureon, you agree to the
          practices described here.
        </p>

        <h2>1. Information we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> email address and password (handled by our
            authentication provider, Supabase).
          </li>
          <li>
            <strong>Birth information:</strong> full name, birth date, birth time (optional), and
            birth location (optional) — used to compute your natal chart and numerology profile.
          </li>
          <li>
            <strong>Chat messages:</strong> everything you send to and receive from the AI chat,
            stored so your conversation history persists across sessions.
          </li>
          <li>
            <strong>Subscription status:</strong> whether you&apos;re on the free or a paid tier,
            and billing-related identifiers from our payment processor — we never receive or store
            your card details.
          </li>
        </ul>
        <p>We don&apos;t collect this information for advertising or sell it to third parties.</p>

        <h2>2. How we use your information</h2>
        <ul>
          <li>To generate your natal chart, numerology profile, and personalized AI chat replies</li>
          <li>To maintain your account and conversation history</li>
          <li>To process subscription payments and manage billing</li>
          <li>To operate, maintain, and improve the Service</li>
          <li>To comply with legal obligations</li>
        </ul>

        <h2>3. Who we share it with</h2>
        <p>We use the following third-party service providers to operate Aureon, each of which processes a subset of your data on our behalf:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — authentication and database hosting (stores your account,
            birth data, and chat history).
          </li>
          <li>
            <strong>Anthropic</strong> — powers the AI chat; your chart, numerology profile, and
            chat messages are sent to Anthropic&apos;s API to generate replies.
          </li>
          <li>
            <strong>Paddle.com</strong> — our merchant of record for subscriptions; handles payment
            processing and billing.
          </li>
          <li>
            <strong>Render</strong> — hosts our application servers.
          </li>
          <li>
            <strong>Google (Google Analytics)</strong> — only if you accept analytics cookies; see
            Section 4.
          </li>
        </ul>
        <p>
          We don&apos;t share your birth information or chat messages with any other third party,
          and we don&apos;t use them to train AI models.
        </p>

        <h2 id="analytics">4. Analytics cookies (only with your consent)</h2>
        <p>
          If you choose <strong>Accept</strong> in the analytics banner, we use Google Analytics 4 to
          understand which pages are visited and how the site is used, so we can improve it. Until you
          accept, Google Analytics is not loaded, sets no cookies and receives nothing. If you choose
          <strong> Reject</strong>, or make no choice, it stays off.
        </p>
        <p>If you accept, Google Analytics sets cookies (named <code>_ga</code> and <code>_ga_…</code>, lasting up to two years) and receives:</p>
        <ul>
          <li>The pages you visit (the page address without any query string, and with account or record identifiers removed) and the site that referred you</li>
          <li>Your device and browser type and your approximate location, derived from your IP address (Google Analytics does not store full IP addresses)</li>
          <li>Simple usage events, such as which tool you opened or that you viewed the pricing page (event names only)</li>
        </ul>
        <p>
          It never receives your name, email, birth information, chart or reading contents, or chat
          messages. We have turned off Google signals and ad personalization, and we don&apos;t use
          analytics data for advertising. Google acts as our service provider and may process data
          outside your country.
        </p>
        <p>
          We save your choice in your browser&apos;s local storage (not a cookie) so we don&apos;t
          keep asking. You can change or withdraw it at any time with the &quot;Analytics
          settings&quot; link in the footer; withdrawing stops collection and removes Google Analytics
          cookies from your browser. Data already collected stays in Google Analytics for the period
          set in our account, and you can ask us to delete it (see Section 7).
        </p>

        <h2>5. Data retention</h2>
        <p>
          We retain your account and profile data for as long as your account is active. You can
          request deletion of your account and associated data at any time (see Section 7).
        </p>

        <h2>6. Security</h2>
        <p>
          We use industry-standard practices (encrypted connections, access controls, row-level
          security on our database) to protect your data. No method of transmission or storage is
          100% secure, and we can&apos;t guarantee absolute security.
        </p>

        <h2>7. Your rights</h2>
        <p>Depending on where you live, you may have rights to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your account and data</li>
          <li>Export your data in a portable format</li>
          <li>Object to or restrict certain processing</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:georgejermizashvili@gmail.com">georgejermizashvili@gmail.com</a>. We&apos;ll
          respond within a reasonable timeframe.
        </p>

        <h2>8. Children&apos;s privacy</h2>
        <p>
          Aureon is not intended for anyone under 18. We don&apos;t knowingly collect information
          from minors.
        </p>

        <h2>9. International data transfers</h2>
        <p>
          Our service providers may process and store data in countries other than your own. Where
          required, we rely on appropriate safeguards for these transfers.
        </p>

        <h2>10. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We&apos;ll post the updated version
          here with a new &quot;Last updated&quot; date.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about this policy or your data? Contact us at{" "}
          <a href="mailto:georgejermizashvili@gmail.com">georgejermizashvili@gmail.com</a>.
        </p>
      </div>
    </section>
  );
}
