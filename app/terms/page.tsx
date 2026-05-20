import Link from "next/link";
import { LegalShell } from "@/components/legal-shell";

export const metadata = {
  title: "Terms of Service — ThreadLens",
};

export default function TermsPage() {
  return (
    <LegalShell
      title={
        <>
          Terms of <em>Service</em>
        </>
      }
      meta={
        <>
          <span className="pill">Effective · April 20, 2026</span>
          <span className="sep"></span>
          <span>Operated by Indo Berkah Solution</span>
          <span className="sep"></span>
          <span>~7 min read</span>
        </>
      }
    >
      <h2>
        <span className="num">01</span>Acceptance of terms
      </h2>
      <p>
        By creating a ThreadLens account or connecting a Threads account to ThreadLens, you agree to these Terms of
        Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the service. ThreadLens is operated by{" "}
        <b>Indo Berkah Solution</b>, Jakarta, Indonesia (&ldquo;we&rdquo;, &ldquo;us&rdquo;).
      </p>

      <h2>
        <span className="num">02</span>The service
      </h2>
      <p>
        ThreadLens is an analytics dashboard for personal and business Threads accounts. We retrieve data through
        Meta&apos;s official Threads Graph API, present it as charts and tables, and generate AI-assisted summaries of
        your content&apos;s performance.
      </p>
      <p>
        The service is <b>read-only</b>. ThreadLens does not post, reply, message, follow, like, repost, or perform any
        other interaction on your behalf.
      </p>

      <h2>
        <span className="num">03</span>Eligibility &amp; accounts
      </h2>
      <ul>
        <li>You must be at least 13 years old to use ThreadLens, in line with Meta&apos;s terms.</li>
        <li>You are responsible for keeping your login credentials confidential and for activity under your account.</li>
        <li>You must provide accurate information when registering and keep it up to date.</li>
        <li>
          One ThreadLens account per person. You may connect multiple Threads accounts you legitimately own or manage.
        </li>
      </ul>

      <h2>
        <span className="num">04</span>Connecting Threads &amp; use of Meta&apos;s API
      </h2>
      <p>
        You connect a Threads account by signing in through Meta&apos;s official OAuth flow. You authorize ThreadLens to
        read your posts and insights via the Threads Graph API. We never see, request, or store your Threads or
        Instagram password.
      </p>
      <p>
        Your use of Threads remains governed by Meta&apos;s terms. We comply with the Threads API terms and the Meta
        Platform Terms; if our use ever conflicts with those, Meta&apos;s terms control with respect to the data
        accessed through their API.
      </p>

      <h2>
        <span className="num">05</span>Acceptable use
      </h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Use ThreadLens to scrape, harvest, or extract data from accounts you do not own or have permission to manage.
        </li>
        <li>
          Resell, redistribute, or commercially exploit raw data obtained through the service in violation of Meta&apos;s
          terms.
        </li>
        <li>Attempt to reverse engineer, decompile, or interfere with the service&apos;s infrastructure.</li>
        <li>
          Use the service to build a competing product or to circumvent rate limits or access controls.
        </li>
        <li>Use the service for any unlawful, deceptive, or harmful purpose.</li>
      </ul>
      <div className="callout">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 5v3.5M8 11v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <div>
          <b>Compliance is non-negotiable.</b>
          <p>
            Violating these rules — or Meta&apos;s Platform Terms — may result in immediate termination of your access
            without refund.
          </p>
        </div>
      </div>

      <h2>
        <span className="num">06</span>AI-assisted analysis
      </h2>
      <p>
        ThreadLens uses third-party large language models (via an LLM gateway powered by Anthropic Claude) to generate
        performance summaries, recommendations, and draft post suggestions. Drafts are suggestions only — you review,
        edit, and decide whether to publish them. Output is provided as informational guidance, not as professional
        advice. We do not guarantee that recommendations will improve account performance.
      </p>
      <p>
        When you trigger an analysis, post content (text and metrics) is sent to the LLM provider for processing. See
        our <Link href="/privacy-policy">Privacy Policy</Link> for details.
      </p>

      <h2>
        <span className="num">07</span>Plans, billing &amp; cancellation
      </h2>
      <p>
        ThreadLens currently offers a free tier and may offer paid plans in the future. Pricing, features, and limits
        are described on the pricing page or in your account at the time of purchase. Paid plans renew automatically
        until cancelled. You may cancel at any time from your account settings; cancellation takes effect at the end of
        the current billing period.
      </p>

      <h2>
        <span className="num">08</span>Your content &amp; data
      </h2>
      <p>
        You retain ownership of all content sourced from your Threads account. By using the service, you grant us a
        limited license to store, process, and display that content solely to provide ThreadLens to you.
      </p>
      <p>
        You may disconnect any Threads account or delete your ThreadLens account at any time. See{" "}
        <Link href="/data-deletion">data deletion instructions</Link>.
      </p>

      <h2>
        <span className="num">09</span>Service availability
      </h2>
      <p>
        We work to keep ThreadLens available and accurate, but we provide the service on an &ldquo;as-is&rdquo; and
        &ldquo;as-available&rdquo; basis. We may modify, suspend, or discontinue features at any time. Threads API rate
        limits, outages, or changes to Meta&apos;s platform may temporarily affect data freshness.
      </p>

      <h2>
        <span className="num">10</span>Intellectual property
      </h2>
      <p>
        The ThreadLens name, logo, interface, and software are owned by Indo Berkah Solution. You may not copy, modify,
        or create derivative works of the service without our written permission. All Meta and Threads trademarks belong
        to Meta Platforms, Inc.
      </p>

      <h2>
        <span className="num">11</span>Disclaimers
      </h2>
      <p>
        To the maximum extent permitted by law, ThreadLens is provided without warranties of any kind, express or
        implied, including merchantability, fitness for a particular purpose, accuracy, or non-infringement. We do not
        warrant that the service will be uninterrupted, error-free, or that AI-generated analysis will be accurate or
        actionable.
      </p>

      <h2>
        <span className="num">12</span>Limitation of liability
      </h2>
      <p>
        To the maximum extent permitted by law, Indo Berkah Solution will not be liable for any indirect, incidental,
        special, consequential, or punitive damages, or any loss of profits, revenue, data, or goodwill, arising from
        your use of the service. Our aggregate liability for any claim relating to the service will not exceed the
        greater of (a) the amount you paid us in the 12 months before the claim, or (b) USD 50.
      </p>

      <h2>
        <span className="num">13</span>Termination
      </h2>
      <p>
        You may stop using ThreadLens at any time. We may suspend or terminate your access if you violate these Terms,
        Meta&apos;s Platform Terms, or if continued service poses a legal or security risk. Upon termination, your data
        will be deleted in accordance with our <Link href="/privacy-policy">Privacy Policy</Link>.
      </p>

      <h2>
        <span className="num">14</span>Changes to these terms
      </h2>
      <p>
        We may update these Terms occasionally. The &ldquo;effective date&rdquo; at the top reflects the latest version.
        Material changes will be communicated by email or in-app notice. Continued use after changes take effect
        constitutes acceptance.
      </p>

      <h2>
        <span className="num">15</span>Governing law
      </h2>
      <p>
        These Terms are governed by the laws of the Republic of Indonesia, without regard to conflict-of-laws
        principles. Any dispute will be resolved in the competent courts of Jakarta, Indonesia.
      </p>

      <h2>
        <span className="num">16</span>Contact
      </h2>
      <p>
        <a href="mailto:bhskindatabase@gmail.com">bhskindatabase@gmail.com</a>
        <br />
        Indo Berkah Solution · Jakarta, Indonesia
      </p>
    </LegalShell>
  );
}
