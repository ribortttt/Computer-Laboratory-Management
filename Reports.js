(function () {
  'use strict';


  const SOURCES = {
    computers:    { key: 'clm_computers',    url: 'computers.json' },
    problems:     { key: 'clm_problems',     url: 'problems.json' },
    usage:        { key: 'clm_usage',        url: null },
    unauthorized: { key: 'clm_unauthorized', url: null }
  };

  const SAMPLE_USAGE = [
    { lab: 'Laboratory 401', classes: 0, hours: 0 },
    { lab: 'Laboratory 402', classes: 0, hours: 0 },
    { lab: 'Laboratory 403', classes: 0, hours: 0 },
    { lab: 'Laboratory 404', classes: 0, hours: 0 },
    { lab: 'Laboratory 405', classes: 0, hours: 0 },
    { lab: 'Laboratory 406', classes: 0, hours: 0 },
    { lab: 'Laboratory 407', classes: 0, hours: 0 },
    { lab: 'Laboratory 408', classes: 0, hours: 0 },
    { lab: 'Laboratory 409', classes: 0, hours: 0 }
  ];
  const SAMPLE_UNAUTHORIZED = [
    { computer: 'Laboratory 403 / PC-02', app: 'Roblox',    minutes: 0, logged: 'Oct 7, 9:10 AM' },
    { computer: 'Laboratory 405 / PC-01', app: 'Minecraft', minutes: 0, logged: 'Oct 7, 2:05 PM' }
  ];

  let usageData = [];
  let problemsData = [];
  let unauthorizedData = [];

  async function loadList(src, fallback) {
    try {
      const saved = localStorage.getItem(src.key);
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.warn('Could not read localStorage:', err);
    }
    if (src.url) {
      try {
        const res = await fetch(src.url);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Could not load ' + src.url, err);
      }
    }
    return fallback;
  }

  const pick = (obj, keys, def = '') => {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return def;
  };

  function formatDate(v) {
    if (!v) return '-';
    let d;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
    d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
    if (isNaN(d)) return String(v);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function normalizeStatus(s) {
    const t = String(s || '').toLowerCase();
    if (t.includes('resolv') || t.includes('done') || t.includes('complete')) return 'Resolved';
    if (t.includes('progress')) return 'In Progress';
    return 'Pending';
  }

  function normalizeProblem(p, computers) {
    const lab = pick(p, ['laboratory', 'lab']);
    const pcRaw = String(pick(p, ['pcNumber', 'pc', 'computer']));
    const id = pick(p, ['computerId', 'pcId']);

    const comp = computers.find((c) =>
      (id !== '' && String(c.id) === String(id)) ||
      (pcRaw && c.pcNumber === pcRaw && (!lab || c.laboratory === lab))
    );

    const labName = lab || (comp && comp.laboratory) || '';
    const pcName = String(pcRaw || (comp && comp.pcNumber) || '').replace(/\s*-\s*/g, '-');
    const computer = pcName.includes('/') ? pcName
      : (labName && pcName ? `${labName} / ${pcName}` : (labName || pcName || '-'));

    let rawDate = pick(p, ['date', 'dateReported', 'reportedDate', 'createdAt']);
    if (!rawDate && p.day && p.month && p.year) {
      rawDate = `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    }

    return {
      computer,
      problem: pick(p, ['problemType', 'problem', 'issue', 'title', 'description'], '-'),
      date: formatDate(rawDate),
      status: normalizeStatus(pick(p, ['status']))
    };
  }

  async function loadAll() {
    const computers = await loadList(SOURCES.computers, []);
    const problems  = await loadList(SOURCES.problems, []);
    const usage     = await loadList(SOURCES.usage, SAMPLE_USAGE);
    const unauth    = await loadList(SOURCES.unauthorized, SAMPLE_UNAUTHORIZED);

    problemsData = problems
      .map((p) => normalizeProblem(p, computers))
      .filter((p) => p.status !== 'Resolved');        

    usageData = usage.map((u) => ({
      lab: pick(u, ['lab', 'laboratory'], '-'),
      classes: Number(pick(u, ['classes'], 0)),
      hours: Number(pick(u, ['hours', 'hoursPerWeek'], 0))
    }));

    unauthorizedData = unauth.map((u) => ({
      computer: pick(u, ['computer'], '-'),
      app: pick(u, ['app', 'application'], '-'),
      minutes: Number(pick(u, ['minutes'], 0)),
      logged: pick(u, ['logged', 'loggedAt'], '-')
    }));
  }

  const PAPER = {
    A4:     { w: 794, h: 1123 },
    Letter: { w: 816, h: 1056 },
    Legal:  { w: 816, h: 1344 }
  };

  const $ = (id) => document.getElementById(id);
  const usageBody        = $('usageBody-reports');
  const problemsBody     = $('problemsBody-reports');
  const unauthorizedBody = $('unauthorizedBody-reports');
  const printView        = $('printView-reports');
  const previewFrame     = $('previewFrame-reports');
  const previewStage     = $('previewStage-reports');
  const previewIframe    = $('previewIframe-reports');
  const optionsPanel     = $('optionsPanel-reports');

  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const statusClass = (s) => 'status-' + s.toLowerCase().replace(/\s+/g, '-') + '-reports';
  const fmtHours = (n) => n.toFixed(1);

  const totals = () => ({
    classes:      usageData.reduce((a, r) => a + r.classes, 0),
    hours:        usageData.reduce((a, r) => a + r.hours, 0),
    problems:     problemsData.length,
    unauthorized: unauthorizedData.reduce((a, r) => a + r.minutes, 0)
  });

  const today = () => new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  function renderTables() {
    usageBody.innerHTML = !usageData.length ? '<tr><td colspan="3">No data.</td></tr>' : usageData.map((r) =>
      `<tr><td>${esc(r.lab)}</td><td>${r.classes}</td><td>${fmtHours(r.hours)}</td></tr>`
    ).join('');

    problemsBody.innerHTML = !problemsData.length ? '<tr><td colspan="4">No open problems.</td></tr>' : problemsData.map((r) =>
      `<tr><td>${esc(r.computer)}</td><td>${esc(r.problem)}</td><td>${esc(r.date)}</td>` +
      `<td class="${statusClass(r.status)}">${esc(r.status)}</td></tr>`
    ).join('');

    unauthorizedBody.innerHTML = !unauthorizedData.length ? '<tr><td colspan="4">No records.</td></tr>' : unauthorizedData.map((r) =>
      `<tr><td>${esc(r.computer)}</td><td>${esc(r.app)}</td><td>${r.minutes}</td><td>${esc(r.logged)}</td></tr>`
    ).join('');
  }

  function getOptions() {
    const orientation = document.querySelector('input[name="orientation"]:checked').value;
    return {
      usage:        $('secUsage-reports').checked,
      problems:     $('secProblems-reports').checked,
      unauthorized: $('secUnauthorized-reports').checked,
      summary:      $('secSummary-reports').checked,
      paper:        $('paperSize-reports').value,
      orientation,
      preparedBy:   $('preparedBy-reports').value.trim() || 'Lab Administrator',
      signature:    $('addSignature-reports').checked
    };
  }

  function pageSize(o) {
    const p = PAPER[o.paper];
    return o.orientation === 'landscape' ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
  }

  function buildReportHTML(o) {
    const t = totals();

    const summary = o.summary ? `
      <div class="cards">
        <div class="card"><b>${t.classes}</b><span>Classes per week</span></div>
        <div class="card"><b>${fmtHours(t.hours)} h</b><span>Lab hours per week</span></div>
        <div class="card"><b>${t.problems}</b><span>Open problems</span></div>
        <div class="card"><b>${t.unauthorized} min</b><span>Unauthorized use</span></div>
      </div>` : '';

    const usage = o.usage ? `
      <h2>Laboratory usage per week</h2>
      <table>
        <thead><tr><th>Laboratory</th><th>Classes</th><th>Hours per week</th></tr></thead>
        <tbody>${usageData.map((r) =>
          `<tr><td>${esc(r.lab)}</td><td>${r.classes}</td><td>${fmtHours(r.hours)}</td></tr>`).join('')}
        </tbody>
      </table>` : '';

    const problems = o.problems ? `
      <h2>Open problems</h2>
      <table>
        <thead><tr><th>Computer</th><th>Problem</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>${problemsData.map((r) =>
          `<tr><td>${esc(r.computer)}</td><td>${esc(r.problem)}</td><td>${esc(r.date)}</td>` +
          `<td class="st ${r.status === 'Pending' ? 'pending' : 'progress'}">${esc(r.status)}</td></tr>`).join('')}
        </tbody>
      </table>` : '';

    const unauthorized = o.unauthorized ? `
      <h2>Unauthorized application use</h2>
      <table>
        <thead><tr><th>Computer</th><th>Application</th><th>Minutes</th><th>Logged</th></tr></thead>
        <tbody>${unauthorizedData.map((r) =>
          `<tr><td>${esc(r.computer)}</td><td>${esc(r.app)}</td><td>${r.minutes}</td><td>${esc(r.logged)}</td></tr>`).join('')}
        </tbody>
      </table>` : '';

    const signature = o.signature ? `
      <div class="sign">
        <div><div class="line"></div><p>Prepared by: ${esc(o.preparedBy)}</p></div>
        <div><div class="line"></div><p>Reviewed by</p></div>
      </div>` : `
      <div class="sign single"><p>Prepared by: ${esc(o.preparedBy)}</p></div>`;

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Laboratory report</title>
<style>
  @page { size: ${o.paper} ${o.orientation}; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #fff; }
  body { font-family: 'Noto Sans', Arial, sans-serif; color: #111; font-size: 11px; }
  .page { min-height: 100vh; padding: 36px 40px 24px; display: flex; flex-direction: column; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          padding-bottom: 10px; border-bottom: 1.5px solid #c8293d; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 11px; line-height: 1.3; }
  .brand img { width: 36px; height: 36px; object-fit: contain; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 17px; font-weight: 800; }
  .title small { color: #777; font-size: 9px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0 4px; }
  .card { border: 1px solid #d5d5d5; border-radius: 6px; padding: 8px 10px; }
  .card b { display: block; font-size: 14px; }
  .card span { font-size: 9px; color: #555; }
  h2 { font-size: 11px; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cfcfcf; padding: 5px 8px; text-align: left; font-size: 10px; }
  th { background: #f5f5f5; font-weight: 600; }
  .st { font-weight: 700; color: #1d3fb8; }
  .st.pending { color: #1d3fb8; }
  .st.progress { color: #1d3fb8; }
  .sign { display: flex; gap: 40px; margin-top: 46px; }
  .sign > div { flex: 1; }
  .sign.single { margin-top: 30px; }
  .line { border-top: 1px solid #111; margin-bottom: 4px; }
  .sign p { margin: 0; font-size: 9px; color: #444; }
  .spacer { flex: 1; }
  .foot { display: flex; justify-content: space-between; border-top: 1px solid #ddd;
          padding-top: 6px; margin-top: 24px; font-size: 8.5px; color: #666; }
</style></head>
<body><div class="page">
  <div class="head">
    <div class="brand"><img src="images/Pcclogo.png" alt=""><span>Computer<br>Laboratory Management</span></div>
    <div class="title"><h1>Laboratory report</h1><small>Generated ${esc(today())}</small></div>
  </div>
  ${summary}${usage}${problems}${unauthorized}${signature}
  <div class="spacer"></div>
  <div class="foot"><span>Computer Laboratory Management</span><span>Page 1 of 1</span></div>
</div></body></html>`;
  }

  function renderPreview() {
    const o = getOptions();
    const size = pageSize(o);

    previewIframe.srcdoc = buildReportHTML(o);
    previewIframe.style.width  = size.w + 'px';
    previewIframe.style.height = size.h + 'px';

    const cs = getComputedStyle(previewFrame);
    const availW = previewFrame.clientWidth  - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = previewFrame.clientHeight - parseFloat(cs.paddingTop)  - parseFloat(cs.paddingBottom);
    const scale = Math.min(availW / size.w, availH / size.h, 1);

    previewIframe.style.transform = `scale(${scale})`;
    previewStage.style.width  = size.w * scale + 'px';
    previewStage.style.height = size.h * scale + 'px';
  }

  function openPrintView() {
    printView.classList.remove('hidden-reports');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(renderPreview);
  }

  function closePrintView() {
    printView.classList.add('hidden-reports');
    document.body.style.overflow = '';
  }

  function printNow() {
    renderPreview();
    previewIframe.onload = function () {
      previewIframe.onload = null;
      previewIframe.contentWindow.focus();
      previewIframe.contentWindow.print();
    };
    previewIframe.srcdoc = buildReportHTML(getOptions());
  }

  $('openPrintBtn-reports').addEventListener('click', openPrintView);
  $('backBtn-reports').addEventListener('click', closePrintView);
  $('printNowBtn-reports').addEventListener('click', printNow);

  optionsPanel.addEventListener('input', renderPreview);
  optionsPanel.addEventListener('change', renderPreview);

  window.addEventListener('resize', () => {
    if (!printView.classList.contains('hidden-reports')) renderPreview();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !printView.classList.contains('hidden-reports')) closePrintView();
  });

  function refresh() {
    loadAll().then(() => {
      renderTables();
      if (!printView.classList.contains('hidden-reports')) renderPreview();
    });
  }

  const WATCHED = Object.values(SOURCES).map((x) => x.key);
  window.addEventListener('storage', (e) => {
    if (e.key === null || WATCHED.includes(e.key)) refresh();
  });
  if ('BroadcastChannel' in window) {
    WATCHED.forEach((k) => new BroadcastChannel(k).addEventListener('message', refresh));
  }
  window.addEventListener('pageshow', (e) => { if (e.persisted) refresh(); });
  window.addEventListener('focus', refresh);

  refresh();
})();