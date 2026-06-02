const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');

const BASE = 'http://127.0.0.1:4173/';
const API = '**/api/rest/v1/**';

function makeDb(now) {
  return {
    users: [
      { uid: 'uA', name: 'Alice Audit', username: 'alice_audit', password: 'x', balance: 100, escrow: 0, last_seen: now },
      { uid: 'uB', name: 'Bob Audit', username: 'bob_audit', password: 'x', balance: 100, escrow: 0, last_seen: now },
      { uid: 'uC', name: 'Cara Audit', username: 'cara_audit', password: 'x', balance: 100, escrow: 0, last_seen: now }
    ],
    challenges: [],
    challenge_votes: [],
    groups: [{ id: 'g1', name: 'Audit Group', icon: 'X', creator_uid: 'uA', created_at: now }],
    group_members: [
      { group_id: 'g1', uid: 'uA', name: 'Alice Audit' },
      { group_id: 'g1', uid: 'uB', name: 'Bob Audit' },
      { group_id: 'g1', uid: 'uC', name: 'Cara Audit' }
    ],
    history: []
  };
}

function eqFilter(value) {
  const match = String(value || '').match(/^eq\.(.*)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function selected(row, select) {
  if (!select) return row;
  const out = {};
  select.split(',').forEach((key) => {
    key = key.trim();
    if (key in row) out[key] = row[key];
  });
  return out;
}

function rowsFor(db, table, url) {
  let rows = db[table].slice();
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'select' || key === 'order' || key === 'limit') continue;
    const eq = eqFilter(value);
    if (eq !== null) rows = rows.filter((row) => String(row[key]) === eq);
  }
  if (url.searchParams.get('order') === 'created_at.desc') {
    rows.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  }
  const limit = parseInt(url.searchParams.get('limit') || '0', 10);
  if (limit) rows = rows.slice(0, limit);
  const select = url.searchParams.get('select');
  return select ? rows.map((row) => selected(row, select)) : rows;
}

function makeRouteHandler(db) {
  return async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const match = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
    const table = match && match[1];
    const method = req.method();
    const send = (data, status) => route.fulfill({
      status: status || 200,
      contentType: 'application/json',
      body: JSON.stringify(data)
    });

    if (!table || !db[table]) return route.fallback();

    if (method === 'GET') return send(rowsFor(db, table, url));

    if (method === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      if (table === 'challenges') {
        const id = body.id || 'current';
        const i = db.challenges.findIndex((row) => row.id === id);
        if (i >= 0) db.challenges[i] = Object.assign({}, db.challenges[i], body);
        else db.challenges.push(Object.assign({}, body, { id }));
      } else if (table === 'challenge_votes') {
        const i = db.challenge_votes.findIndex((row) => row.challenge_id === body.challenge_id && row.voter_uid === body.voter_uid);
        if (i >= 0) db.challenge_votes[i] = Object.assign({}, db.challenge_votes[i], body);
        else db.challenge_votes.push(body);
      } else if (table === 'group_members') {
        const i = db.group_members.findIndex((row) => row.group_id === body.group_id && row.uid === body.uid);
        if (i >= 0) db.group_members[i] = Object.assign({}, db.group_members[i], body);
        else db.group_members.push(body);
      } else {
        db[table].push(body);
      }
      return send([body]);
    }

    if (method === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}');
      for (const [key, value] of url.searchParams.entries()) {
        const eq = eqFilter(value);
        if (eq !== null) db[table].filter((row) => String(row[key]) === eq).forEach((row) => Object.assign(row, body));
      }
      return send([]);
    }

    if (method === 'DELETE') {
      db[table] = db[table].filter((row) => {
        for (const [key, value] of url.searchParams.entries()) {
          const eq = eqFilter(value);
          if (eq !== null && String(row[key]) !== eq) return true;
        }
        return false;
      });
      return send([]);
    }

    return send([]);
  };
}

async function active(page) {
  return page.locator('.screen.active').getAttribute('id');
}

async function bootPage(browser, db, uid, name, username) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route(API, makeRouteHandler(db));
  await context.addInitScript(([u, n, user]) => {
    localStorage.setItem('stash_uid_v3', u);
    localStorage.setItem('stash_name_v3', n);
    localStorage.setItem('stash_user_v3', user);
    localStorage.setItem('stash_terms_v3', '1');
  }, [uid, name, username]);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  return page;
}

async function run() {
  const server = spawn('python3', ['-m', 'http.server', '4173'], { cwd: process.cwd(), stdio: 'ignore' });
  await new Promise((resolve) => setTimeout(resolve, 800));

  const db = makeDb(Date.now());
  const browser = await chromium.launch({ headless: true });

  try {
    const pageA = await bootPage(browser, db, 'uA', 'Alice Audit', 'alice_audit');
    await pageA.locator('.card.card-tap').filter({ hasText: 'Audit Group' }).click();
    await pageA.click('text=+ Lancia una sfida');
    await pageA.fill('#ch-text', 'Audit one vs one');
    await pageA.fill('#ch-amount', '1');
    await pageA.locator('#ch-members-list .member-row').filter({ hasText: 'bob_audit' }).click();
    await pageA.click('#ch-btn');

    const pageB = await bootPage(browser, db, 'uB', 'Bob Audit', 'bob_audit');
    await pageB.locator('#global-notif').click();
    await pageB.click('#acc-btn');
    await pageA.locator('#global-notif').click();
    await pageA.click('#v1-btn-me');
    await pageB.click('#v1-btn-other');
    await pageA.click('#v1-agree button');
    await pageA.waitForTimeout(500);

    if (db.users.find((u) => u.uid === 'uA').balance !== 101) throw new Error('1v1 winner balance mismatch');
    if (db.users.find((u) => u.uid === 'uB').balance !== 99) throw new Error('1v1 loser balance mismatch');

    const db2 = makeDb(Date.now());
    const multiA = await bootPage(browser, db2, 'uA', 'Alice Audit', 'alice_audit');
    await multiA.locator('.card.card-tap').filter({ hasText: 'Audit Group' }).click();
    await multiA.click('text=+ Lancia una sfida');
    await multiA.locator('#type-chips .chip[data-t="1vall"]').click();
    await multiA.fill('#ch-text', 'Audit one vs all');
    await multiA.fill('#ch-amount', '10');
    await multiA.locator('#ch-members-list .member-row').filter({ hasText: 'bob_audit' }).click();
    await multiA.locator('#ch-members-list .member-row').filter({ hasText: 'cara_audit' }).click();
    await multiA.click('#ch-btn');
    await multiA.click('text=Torna al gruppo');
    await multiA.waitForTimeout(3500);
    if (!(await multiA.locator('#cg-live-challenge').isVisible())) throw new Error('multi challenge not visible in group');

    await multiA.evaluate(() => go('s-vote-group'));
    await multiA.locator('#vg-btn-row button').filter({ hasText: 'Bob Audit' }).click();
    const multiB = await bootPage(browser, db2, 'uB', 'Bob Audit', 'bob_audit');
    await multiB.evaluate(() => go('s-vote-group'));
    await multiB.locator('#vg-btn-row button').filter({ hasText: 'Bob Audit' }).click();
    await multiB.waitForTimeout(500);

    if (db2.history[0].winner_uid !== 'uB') throw new Error('multi winner should be a single uid');
    if (db2.users.find((u) => u.uid === 'uB').balance !== 115) throw new Error('multi winner payout mismatch');
    if (db2.users.find((u) => u.uid === 'uC').escrow !== 0) throw new Error('multi loser escrow not released');

    const db3 = makeDb(Date.now());
    const rejectA = await bootPage(browser, db3, 'uA', 'Alice Audit', 'alice_audit');
    await rejectA.locator('.card.card-tap').filter({ hasText: 'Audit Group' }).click();
    await rejectA.click('text=+ Lancia una sfida');
    await rejectA.fill('#ch-text', 'Audit rejected');
    await rejectA.fill('#ch-amount', '4');
    await rejectA.locator('#ch-members-list .member-row').filter({ hasText: 'bob_audit' }).click();
    await rejectA.click('#ch-btn');
    const rejectB = await bootPage(browser, db3, 'uB', 'Bob Audit', 'bob_audit');
    await rejectB.locator('#global-notif').click();
    await rejectB.click('text=Rifiuto');
    await rejectB.waitForTimeout(500);
    if (db3.users.find((u) => u.uid === 'uA').balance !== 100) throw new Error('reject should refund challenger balance');
    if (db3.users.find((u) => u.uid === 'uA').escrow !== 0) throw new Error('reject should clear challenger escrow');
    if (!db3.history[0] || db3.history[0].status !== 'rejected') throw new Error('reject should write rejected history');

    console.log('mock e2e ok');
  } finally {
    await browser.close();
    server.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
