import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — CricSync',
};

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-ink mb-2">Terms of Service</h1>
      <p className="text-sm text-ink-muted mb-8">Last updated: 2026-08-11</p>

      <div className="space-y-6 text-sm text-ink-secondary leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:mb-3">
        <p>
          These Terms of Service ("Terms") govern your use of CricSync (the "Service"), a cricket club,
          tournament, and community application. By creating an account or using the Service, you agree
          to these Terms.
        </p>

        <section>
          <h2>1. Who can use CricSync</h2>
          <p>
            You must be at least 13 years old to create an account. If you are between 13 and 17, you may
            only use CricSync with the consent and involvement of a parent or guardian, who is responsible
            for your use of the Service. Team captains, organizers, or coaches adding a player under 18 to
            a roster confirm they have the appropriate consent to do so.
          </p>
        </section>

        <section>
          <h2>2. What CricSync is for</h2>
          <p>
            CricSync provides live ball-by-ball scoring, tournament and team management, player statistics
            and tactical insights, a free points-based match prediction game, community news, coaching
            content, and a marketplace connecting buyers and sellers of cricket equipment. Features may be
            added, changed, or removed at any time as the Service develops.
          </p>
        </section>

        <section>
          <h2>3. The prediction game is not gambling</h2>
          <p>
            CricSync's match prediction feature is a free-to-play points and leaderboard game. It involves
            no entry fee, no real-money stake, and no cash or monetary payout of any kind. Points have no
            cash value and cannot be redeemed, transferred, purchased, or sold.
          </p>
        </section>

        <section>
          <h2>4. Your account</h2>
          <p>
            You're responsible for keeping your account credentials secure and for all activity under your
            account. Tell us right away if you believe your account has been accessed without your
            permission.
          </p>
        </section>

        <section>
          <h2>5. Content you provide</h2>
          <p>
            Match data, statistics, commentary, news posts, lesson content, and marketplace listings you
            submit remain yours, but by submitting them you give CricSync a license to store, display, and
            process that content in order to operate the Service (for example, generating auto-commentary,
            match reports, and statistics from ball-by-ball data you enter). Don't submit content that's
            false, abusive, or that you don't have the right to share.
          </p>
        </section>

        <section>
          <h2>6. Marketplace</h2>
          <p>
            The marketplace connects buyers and sellers directly. CricSync is not a party to the sale
            itself and doesn't guarantee the condition, quality, or delivery of any listed item. Sellers
            are responsible for the accuracy of their own listings.
          </p>
        </section>

        <section>
          <h2>7. Acceptable use</h2>
          <p>
            Don't use CricSync to harass others, submit fraudulent match data, attempt to access accounts
            or systems without authorization, or interfere with the Service's normal operation.
          </p>
        </section>

        <section>
          <h2>8. Disclaimers</h2>
          <p>
            CricSync is provided "as is." Statistics, win-probability estimates, tactical insights, and
            auto-generated commentary or articles are computed from the data entered into the Service and
            may be incomplete or inaccurate — they're a tool to support your own judgment, not a
            guaranteed-accurate record. We don't guarantee the Service will always be available or
            error-free.
          </p>
        </section>

        <section>
          <h2>9. Limitation of liability</h2>
          <p>
            To the extent permitted by law, CricSync and its operators aren't liable for indirect,
            incidental, or consequential damages arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2>10. Changes to these Terms</h2>
          <p>
            We may update these Terms as the Service grows. We'll post the updated Terms here with a new
            "Last updated" date; continued use of CricSync after a change means you accept the update.
          </p>
        </section>

        <section>
          <h2>11. Contact</h2>
          <p>Questions about these Terms? Reach out via the contact details on our homepage.</p>
        </section>
      </div>

      <p className="mt-10 text-xs text-ink-muted">
        See also our <Link href="/privacy" className="text-gold-500 hover:text-gold-400">Privacy Policy</Link>.
      </p>
    </main>
  );
}
