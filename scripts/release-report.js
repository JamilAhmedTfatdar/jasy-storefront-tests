// Turns the test runs into the release report: pass rates, failed tests, open bugs by severity,
// the two gates from the test and release plan, a message for the team chat, and a go-live recommendation.
//
//   node scripts/release-report.js --mobile release/mobile-run.txt --desktop release/desktop.json [--phone release/phone.json]
//
// --mobile   the terminal output of the iOS Simulator run (npm test in ios-sim, saved with tee)
// --desktop  the Playwright JSON of the desktop run
// --phone    optional: the Playwright JSON of the phone-size run
// Bugs and manual checks come from release/bugs.json and release/manual.json (edit those files, not this script).
// It never changes the store and never runs a test.
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf('--' + name);
  return i === -1 ? null : args[i + 1];
};
// A run file that does not exist yet counts as "not supplied".
const runArg = (name) => {
  const file = arg(name);
  return file !== null && fs.existsSync(path.resolve(path.join(__dirname, '..'), file)) ? file : null;
};

const root = path.join(__dirname, '..');
const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'));
  } catch (e) {
    return fallback;
  }
};
const ids = (title) => Array.from(new Set(title.match(/\b(?:TC|EX-)\d{2}\b/g) || []));

// ---------- the Simulator run (text from the spec reporter) ----------
function parseSimulator(file) {
  const text = fs.readFileSync(path.resolve(root, file), 'utf8').replace(/\x1b\[[0-9;]*m/g, '');
  const byTitle = new Map();
  for (const raw of text.split('\n')) {
    const m = raw.match(/^(?:\[[^\]]*\]\s*)?\s*(✓|✖|✗|-|\?)\s+((?:TC|EX-)\d{2}.*?)(?:\s+\(\d+(?:\.\d+)?m?s\))?\s*$/);
    if (!m) continue;
    const mark = m[1];
    const title = m[2].trim();
    const status = mark === '✓' ? 'passed' : mark === '-' || mark === '?' ? 'skipped' : 'failed';
    // the last line printed for a test wins (a skipped test prints "?" and then "-")
    byTitle.set(title, status);
  }
  return Array.from(byTitle, ([title, status]) => ({ title, ids: ids(title), status, notes: [] }));
}

// ---------- a Playwright JSON run ----------
function parsePlaywright(file, project) {
  const data = JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'));
  const out = [];
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        if (project && t.projectName !== project) continue;
        const last = t.results && t.results.length > 0 ? t.results[t.results.length - 1] : null;
        let status = 'failed';
        if (t.status === 'expected' || t.status === 'flaky') status = 'passed';
        else if (t.status === 'skipped') status = 'skipped';
        const notes = (t.annotations || []).filter((a) => a.type === 'finding').map((a) => a.description);
        const error = status === 'failed' && last && last.error ? String(last.error.message || '').replace(/\x1b\[[0-9;]*m/g, '').split('\n')[0] : '';
        out.push({ title: spec.title, ids: ids(spec.title), status, notes, error, project: t.projectName });
      }
    }
    for (const s of suite.suites || []) walk(s);
  };
  for (const s of data.suites || []) walk(s);
  return out;
}

function summarize(results) {
  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const ran = passed + failed;
  const rate = ran === 0 ? 0 : (passed / ran) * 100;
  return { passed, failed, skipped, ran, rate, failures: results.filter((r) => r.status === 'failed') };
}

const mobileFile = runArg('mobile');
const desktopFile = runArg('desktop');
const phoneFile = runArg('phone');
const bugsFile = arg('bugs') || 'release/bugs.json';
const manualFile = arg('manual') || 'release/manual.json';

const bugs = readJson(bugsFile, { bugs: [] }).bugs;
const manual = readJson(manualFile, { checks: [] }).checks;
const severityOrder = ['Blocker', 'Major', 'Minor', 'Trivial'];
const openBugs = bugs.filter((b) => b.status === 'open');
const countBy = (list, sev) => list.filter((b) => b.severity === sev).length;
const openBlocking = (releaseToo) => openBugs.filter((b) => (b.severity === 'Blocker' || b.severity === 'Major') && (releaseToo || b.releaseOnly !== true));

const lines = [];
const out = (s = '') => lines.push(s);
const pct = (n) => n.toFixed(1) + '%';
const when = new Date().toISOString().slice(0, 10);

out('# JASY Everyday release report');
out('');
out('Date: ' + when + '. Store: https://jasyeveryday.com. Plan: Test and Release Plan, TC01 to TC56.');
out('');

// ---------- step 1: mobile ----------
let mobile = null;
let gateOpen = null;
out('## 1. Mobile tests (iOS Simulator, real Safari)');
out('');
if (mobileFile === null) {
  out('No mobile run supplied. Run the Simulator suite and save its output: `cd ios-sim; APPIUM_PORT=4733 npm test 2>&1 | tee ../release/mobile-run.txt`.');
} else {
  mobile = summarize(parseSimulator(mobileFile));
  out('Pass rate: **' + pct(mobile.rate) + '** (' + mobile.passed + ' passed, ' + mobile.failed + ' failed, ' + mobile.skipped + ' skipped; skipped tests are not counted).');
  if (mobile.failures.length > 0) {
    out('');
    out('Failed:');
    for (const f of mobile.failures) out('- ' + f.title);
  }
  const blockers = openBlocking(false);
  gateOpen = mobile.rate >= 80 && blockers.length === 0;
  out('');
  out('Gate to start desktop testing: pass rate 80% or more **' + (mobile.rate >= 80 ? 'met' : 'NOT met') + '**; no open Major or Blocker bug **' + (blockers.length === 0 ? 'met' : 'NOT met') + '**' + (blockers.length > 0 ? ' (' + blockers.map((b) => b.id + ' ' + b.title).join('; ') + ')' : '') + '.');
  out('Result: **' + (gateOpen ? 'desktop testing may start' : 'resolve the issues above and rerun the affected tests first') + '**.');
}
out('');

// ---------- step 2: desktop ----------
let desktop = null;
out('## 2. Desktop tests (Playwright, Chrome)');
out('');
if (desktopFile === null) {
  out('No desktop run supplied yet.');
} else {
  desktop = summarize(parsePlaywright(desktopFile, 'desktop'));
  out('Pass rate: **' + pct(desktop.rate) + '** (' + desktop.passed + ' passed, ' + desktop.failed + ' failed, ' + desktop.skipped + ' skipped).');
  if (desktop.failures.length > 0) {
    out('');
    out('Failed:');
    for (const f of desktop.failures) out('- ' + f.title + (f.error ? ' (' + f.error.slice(0, 140) + ')' : ''));
  }
}
let phone = null;
if (phoneFile) {
  phone = summarize(parsePlaywright(phoneFile, 'mobile'));
  out('');
  out('Phone sizes in Playwright (390x844 and 430x932): **' + pct(phone.rate) + '** (' + phone.passed + ' passed, ' + phone.failed + ' failed, ' + phone.skipped + ' skipped).');
  for (const f of phone.failures) out('- ' + f.title + (f.error ? ' (' + f.error.slice(0, 140) + ')' : ''));
}
out('');

// ---------- manual checks ----------
out('## Manual checks (Shopify Admin, CJ, payment; never automated)');
out('');
if (manual.length === 0) out('No manual checklist file found (release/manual.json).');
for (const c of manual) out('- ' + c.id + ' ' + c.title + ': **' + c.status + '**' + (c.note ? ' (' + c.note + ')' : ''));
const manualPending = manual.filter((c) => c.status !== 'pass');
out('');

// ---------- bugs ----------
out('## Open bugs by severity');
out('');
for (const sev of severityOrder) {
  const list = openBugs.filter((b) => b.severity === sev);
  out('- ' + sev + ': ' + list.length + (list.length > 0 ? ' (' + list.map((b) => b.id + ' ' + b.title).join('; ') + ')' : ''));
}
const closed = bugs.filter((b) => b.status !== 'open');
if (closed.length > 0) out('- Closed or verified: ' + closed.map((b) => b.id).join(', '));
out('');

// ---------- step 4: decision ----------
const blockingNow = openBlocking(true);
let recommendation;
if (blockingNow.length > 0) recommendation = 'HOLD';
else if (mobile === null || desktop === null) recommendation = 'NOT DECIDED (a test run is missing)';
else if (manualPending.length > 0) recommendation = 'HOLD until the manual checks pass';
else recommendation = 'GO';
// ---------- step 3: chat message ----------
out('## 3. Message for the team chat');
out('');
out('```');
out('JASY Everyday test run ' + when);
if (mobile) out('Mobile (iOS Simulator): ' + pct(mobile.rate) + ' pass (' + mobile.passed + '/' + mobile.ran + '). Failed: ' + (mobile.failures.map((f) => f.ids.join('+')).join(', ') || 'none'));
if (desktop) out('Desktop (Chrome): ' + pct(desktop.rate) + ' pass (' + desktop.passed + '/' + desktop.ran + '). Failed: ' + (desktop.failures.map((f) => f.ids.join('+') || f.title.slice(0, 30)).join(', ') || 'none'));
if (phone) out('Phone sizes (Playwright): ' + pct(phone.rate) + ' pass (' + phone.passed + '/' + phone.ran + ').');
out('Open bugs: Blocker ' + countBy(openBugs, 'Blocker') + ', Major ' + countBy(openBugs, 'Major') + ', Minor ' + countBy(openBugs, 'Minor') + ', Trivial ' + countBy(openBugs, 'Trivial'));
out('Manual checks passed: ' + (manual.length - manualPending.length) + '/' + manual.length);
out('Recommendation: ' + recommendation);
out('```');

out('## 4. Go-live decision');
out('');
out('Recommendation: **' + recommendation + '**.');
out('');
if (blockingNow.length > 0) {
  out('Reason: open Major or Blocker bug(s): ' + blockingNow.map((b) => b.id + ' (' + b.severity + ') ' + b.title).join('; ') + '.');
} else if (manualPending.length > 0) {
  out('Reason: no open Major or Blocker bug, but these checks are not passed yet: ' + manualPending.map((c) => c.id).join(', ') + '.');
}
out('');
out('Final decision (store owner): ______________   Date: ____________   Signed: Jamil');
out('');

const reportFile = path.join(root, 'release', 'RELEASE-REPORT.md');
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.log('\nSaved release/RELEASE-REPORT.md');
