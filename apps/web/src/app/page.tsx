import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

/**
 * Crawler/scraper user-agent fragments. When one of these fetches `/` we
 * serve a tiny HTML shell whose only job is to expose the root layout's
 * Open Graph metadata. Real browsers get the usual redirect to /login.
 *
 * Without this, WhatsApp / Slack / iMessage / LinkedIn etc. follow the
 * server redirect and end up reading /login's HTML — which can be partially
 * client-rendered, behind a route group, or otherwise miss the OG tags.
 */
const SOCIAL_BOT_PATTERNS =
  /facebookexternalhit|facebot|whatsapp|twitterbot|slackbot|linkedinbot|telegrambot|discordbot|skypeuripreview|googlebot|bingbot|applebot|pinterest/i;

export default async function HomePage() {
  const ua = (await headers()).get('user-agent') || '';
  const isBot = SOCIAL_BOT_PATTERNS.test(ua);

  if (!isBot) {
    redirect('/login');
  }

  // Bot path: render a minimal preview page. The metadata in the root
  // layout supplies all OG/Twitter tags, so the scraper has everything
  // it needs without following any redirect.
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Campus Verse</h1>
      <p>Education Needs More Than ERP — a unified platform for educational institutions.</p>
    </main>
  );
}
