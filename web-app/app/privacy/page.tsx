import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — CricRoots',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-ink mb-2">Privacy Policy</h1>
      <p className="text-sm text-ink-muted mb-8">Last updated: 2026-08-11</p>

      <div className="space-y-6 text-sm text-ink-secondary leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:mb-3 [&_li]:mb-1.5">
        <p>
          This Privacy Policy explains what information CricRoots collects, how it's used, and the choices
          you have.
        </p>

        <section>
          <h2>1. What we collect</h2>
          <ul className="list-disc pl-5">
            <li><strong className="text-ink">Account information:</strong> name, email address, and password (stored securely, never in plain text), and role (player, organizer, etc.)</li>
            <li><strong className="text-ink">Player &amp; team data:</strong> specialization, batting/bowling style, team memberships, and match performance you or your organizer enter</li>
            <li><strong className="text-ink">Match data:</strong> ball-by-ball scoring data, including optional voice input transcripts used only to fill in scoring fields on your device — voice audio is not stored after it's transcribed</li>
            <li><strong className="text-ink">Prediction &amp; engagement data:</strong> your picks in the free prediction game and resulting points</li>
            <li><strong className="text-ink">Marketplace data:</strong> listings, cart, and order information if you buy or sell equipment</li>
            <li><strong className="text-ink">Usage data:</strong> basic technical information (like device type and app version) needed to keep the Service running reliably</li>
          </ul>
        </section>

        <section>
          <h2>2. How we use it</h2>
          <p>
            We use this information to operate the Service: running live scoring, computing statistics and
            tactical insights, generating auto-commentary and tournament match reports, settling the
            prediction game, running the marketplace, and improving the app. We do not sell your personal
            information to third parties.
          </p>
        </section>

        <section>
          <h2>3. Who sees what</h2>
          <p>
            Match scores, team rosters, tournament standings, and player statistics are visible to other
            users as part of normal Service operation (this is a team sport — scores are meant to be
            shared). Auto-generated tournament news is visible publicly and, with extra emphasis, to
            players registered in that tournament. Your account password is never visible to anyone,
            including CricRoots staff.
          </p>
        </section>

        <section>
          <h2>4. Children's privacy</h2>
          <p>
            CricRoots isn't directed at children under 13, and we don't knowingly collect personal
            information from anyone under 13. Players between 13 and 17 may only use the Service with a
            parent or guardian's involvement. If you believe a child under 13 has created an account,
            contact us and we'll remove it.
          </p>
        </section>

        <section>
          <h2>5. Where your data lives</h2>
          <p>
            Data is stored on the infrastructure that hosts CricRoots's backend and database. We use
            reasonable technical and organizational measures to protect it, but no online service can
            guarantee perfect security.
          </p>
        </section>

        <section>
          <h2>6. Your choices</h2>
          <p>
            You can update your profile information at any time. To request a copy of your data or ask
            that your account be deleted, contact us via the details on our homepage — we'll respond
            within a reasonable time.
          </p>
        </section>

        <section>
          <h2>7. Changes to this policy</h2>
          <p>
            If this policy changes, we'll update the date at the top of this page. We'll flag material
            changes more prominently if they affect how your data is used.
          </p>
        </section>

        <section>
          <h2>8. Contact</h2>
          <p>Questions about this policy or your data? Reach out via the contact details on our homepage.</p>
        </section>
      </div>

      <p className="mt-10 text-xs text-ink-muted">
        See also our <Link href="/terms" className="text-gold-500 hover:text-gold-400">Terms of Service</Link>.
      </p>
    </main>
  );
}
