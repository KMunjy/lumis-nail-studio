/**
 * LUMIS Privacy Policy — required by:
 *   GDPR Art. 13 (data collected directly from subject)
 *   POPIA Section 18 (notification to data subjects)
 *
 * Policy version: 1.0.0 — must match CURRENT_POLICY_VERSION in consent.ts
 * Effective date: 12 April 2026
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | LUMIS",
  description: "How LUMIS collects, uses and protects your personal information — GDPR & POPIA compliant.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--color-void)", color: "var(--color-bone)" }}>
      {/* Nav */}
      <div className="sticky top-0 z-10 border-b px-6 py-4 flex items-center gap-4"
        style={{ backgroundColor: "rgba(10,9,7,0.9)", backdropFilter: "blur(16px)", borderColor: "rgba(255,255,255,0.06)" }}>
        <Link href="/" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-terra-mid)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          ← Back
        </Link>
        <span style={{ color: "rgba(255,255,255,0.1)" }}>|</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(249,246,242,0.3)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          LUMIS Privacy Policy — v1.0.0
        </span>
      </div>

      <article className="max-w-2xl mx-auto px-6 py-16">
        <header className="mb-12">
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-terra-mid)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 12 }}>
            LUMIS COUTURE LTD · DATA PROTECTION NOTICE
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, fontStyle: "italic", fontWeight: 400, lineHeight: 1.1, marginBottom: 16 }}>
            Privacy Policy
          </h1>
          <p style={{ color: "rgba(249,246,242,0.4)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            Effective: 12 April 2026 · Policy version: 1.0.0
          </p>
        </header>

        <div className="space-y-10" style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(249,246,242,0.7)" }}>

          <Section title="1. Who we are">
            <p>
              Data controller: <strong style={{ color: "var(--color-bone)" }}>LUMIS Couture Ltd</strong> (&ldquo;LUMIS&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
              This notice applies to the LUMIS Nail Studio web application (&ldquo;the App&rdquo;).
            </p>
            <p className="mt-3">
              This policy satisfies disclosure obligations under the EU <strong style={{ color: "var(--color-bone)" }}>General Data Protection
              Regulation (GDPR) Articles 13–14</strong> and the South African <strong style={{ color: "var(--color-bone)" }}>Protection of Personal
              Information Act 4 of 2013 (POPIA) Section 18</strong>.
            </p>
          </Section>

          <Section title="2. What personal data we process">
            <Table rows={[
              ["Camera feed", "On-device hand landmark coordinates (21 XYZ points per frame)", "Functional — AR try-on experience", "Duration of studio session only — never stored"],
              ["Cart contents", "Product IDs + timestamps (no personal identifiers)", "Legitimate interest / consent", "30 days from addition; purged automatically"],
              ["Consent record", "Timestamp, policy version accepted", "Legal obligation (Art. 7 / POPIA §11)", "Until consent is withdrawn"],
              ["Captured images", "PNG of camera frame + nail overlay (user-initiated)", "Consent", "Browser memory only — erased on page close"],
            ]} />
          </Section>

          <Section title="3. Camera & biometric data">
            <p>
              Your camera feed is processed <strong style={{ color: "var(--color-bone)" }}>entirely on your device</strong> using
              MediaPipe Hand Landmarker (Google LLC, open-source Apache 2.0). The model extracts
              21 XYZ skeletal landmarks from each video frame to position the virtual nail overlay.
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li>No video frames are transmitted to any server.</li>
              <li>No images are stored on our servers.</li>
              <li>No biometric templates or identifiers are generated.</li>
              <li>Camera access is terminated when you leave the studio page.</li>
            </ul>
            <p className="mt-3">
              Under GDPR Article 9, data revealing biometric characteristics for unique identification
              is special-category. We have architecturally eliminated this risk by processing only
              ephemeral skeletal coordinates which cannot identify an individual.
            </p>
          </Section>

          <Section title="4. Cookies & local storage">
            <p>
              <strong style={{ color: "var(--color-bone)" }}>We set no cookies.</strong> The App uses
              browser <code style={{ backgroundColor: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>localStorage</code> only
              for the following functional purposes:
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li><code style={{ backgroundColor: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>lumis_cart_v1</code> — your shopping bag (product IDs + timestamps)</li>
              <li><code style={{ backgroundColor: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>lumis_consent_v1</code> — your consent record</li>
            </ul>
            <p className="mt-3">
              No third-party analytics, advertising pixels, or tracking scripts are loaded by this App.
            </p>
          </Section>

          <Section title="5. Third-party services">
            <Table rows={[
              ["MediaPipe / Google LLC", "Hand landmark model file (25 MB, loaded once)", "cdn.jsdelivr.net / storage.googleapis.com", "No personal data sent — model weights only"],
              ["Google Fonts", "DM Sans, JetBrains Mono, Cormorant typefaces", "fonts.gstatic.com", "Font files only; Google may log your IP"],
              ["Unsplash", "Product catalogue images", "images.unsplash.com", "No personal data sent"],
            ]} />
          </Section>

          <Section title="6. Your rights">
            <p>Under GDPR (Chapter III) and POPIA (Part 3), you have the right to:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li><strong style={{ color: "var(--color-bone)" }}>Access (Art. 15 / POPIA §23)</strong> — request a copy of data we hold about you.</li>
              <li><strong style={{ color: "var(--color-bone)" }}>Erasure (Art. 17 / POPIA §24)</strong> — erase all locally stored data immediately from your <Link href="/profile" style={{ color: "var(--color-terra-mid)", textDecoration: "underline" }}>Profile</Link> page.</li>
              <li><strong style={{ color: "var(--color-bone)" }}>Withdraw consent (Art. 7(3) / POPIA §11(6))</strong> — withdraw at any time without detriment from your Profile page.</li>
              <li><strong style={{ color: "var(--color-bone)" }}>Lodge a complaint</strong> — with your supervisory authority (ICO for UK; EDPB for EU; Information Regulator for South Africa).</li>
            </ul>
          </Section>

          <Section title="7. Data retention">
            <p>
              Cart data is automatically deleted 30 days after items are added.
              Consent records are retained until withdrawn. Camera data is never retained beyond the
              current frame&apos;s landmark computation (~16 ms at 60 fps).
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              The App is served over HTTPS with HSTS enforced for 1 year. All external resources
              are controlled by a strict Content Security Policy. The Docker runtime image runs as
              a non-root user (uid 1001). Dependency vulnerabilities are scanned on every CI run
              via npm audit and Trivy.
            </p>
          </Section>

          <Section title="9. Contact">
            <p>
              For data protection enquiries: <strong style={{ color: "var(--color-bone)" }}>privacy@lumis.studio</strong>
            </p>
            <p className="mt-2">
              Information Regulator (South Africa): <strong style={{ color: "var(--color-bone)" }}>inforeg.org.za</strong>
            </p>
          </Section>

          <div className="pt-8 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", fontSize: 11, color: "rgba(249,246,242,0.25)" }}>
            Policy version 1.0.0 · Effective 12 April 2026 · Next review: 12 April 2027
          </div>
        </div>
      </article>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-bone)", marginBottom: 12 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Table({ rows }: { rows: string[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "8px 12px", color: j === 0 ? "rgba(249,246,242,0.85)" : "rgba(249,246,242,0.45)", verticalAlign: "top" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
