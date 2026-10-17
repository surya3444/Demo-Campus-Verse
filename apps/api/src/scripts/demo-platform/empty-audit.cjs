// Signs in as each role, opens every sidebar link, and reports pages that show
// an empty state. usage: node empty-audit.cjs <outJson> email...
const { chromium } = require('/Users/rajchavin/Projects/campusverse/campus-verse-hub/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [outJson, ...emails] = process.argv.slice(2);
const pwLines = fs.readFileSync(path.resolve(__dirname, '../../../../../../demo-password.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const BASE = 'http://localhost:3300';
const EMPTY = /\b(no [a-z ]{2,40} (found|yet|available|scheduled|recorded)|nothing (here|to show|on the board|to report)|no data( yet)?|create your first|get started by|you haven.t|no records|0 results|empty)\b/i;

(async () => {
  const browser = await chromium.launch({ executablePath: '/Users/rajchavin/Library/Caches/ms-playwright/chromium-1234/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
  const report = {};
  for (const email of emails) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let ok = false;
    for (const pw of pwLines) {
      await page.goto(BASE + '/login', { timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await page.fill('#email', email);
      await page.fill('#password', pw);
      await page.click('button[type=submit]');
      ok = await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).then(() => true).catch(() => false);
      if (ok) break;
    }
    if (!ok) {
      console.log(email, 'LOGIN FAILED');
      continue;
    }
    await page.goto(BASE + '/dashboard', { waitUntil: 'load' });
    await page.waitForSelector('aside a[href^="/"]', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const links = await page.evaluate(() =>
      [...new Set([...document.querySelectorAll('aside a[href^="/"]')].map((a) => a.getAttribute('href')))]
    );
    const items = [];
    for (const href of links) {
      await page.goto(BASE + href, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2200);
      const text = (await page.innerText('main').catch(() => '')).replace(/\s+/g, ' ');
      const m = text.match(EMPTY);
      items.push({ href, empty: m ? m[0] : null, snippet: m ? text.slice(Math.max(0, m.index - 60), m.index + 80) : '' });
      await page.waitForTimeout(300);
    }
    report[email] = items;
    console.log(`${email}: ${items.length} pages, ${items.filter((i) => i.empty).length} with empty states`);
    for (const i of items.filter((x) => x.empty)) console.log(`   ${i.href.padEnd(42)} "${i.empty}"`);
    await page.close();
  }
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
  await browser.close();
})();
