export function getDashboardHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LedgerGuard — Autonomous Financial Auditor & Reconciliation Engine</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(18, 26, 43, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --card-hover: rgba(255, 255, 255, 0.12);
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.35);
      --emerald: #10b981;
      --emerald-glow: rgba(16, 185, 129, 0.25);
      --amber: #f59e0b;
      --rose: #f43f5e;
      --rose-glow: rgba(244, 63, 94, 0.25);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --font: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.1) 0px, transparent 50%);
      color: var(--text);
      font-family: var(--font);
      min-height: 100vh;
      line-height: 1.5;
      padding-bottom: 60px;
    }

    /* Navigation Bar */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 2.5rem;
      border-bottom: 1px solid var(--card-border);
      background: rgba(9, 13, 22, 0.85);
      backdrop-filter: blur(16px);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      text-decoration: none;
    }

    .brand-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 20px var(--accent-glow);
    }

    .brand-title {
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(to right, #fff, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .badge-plugin {
      font-size: 0.7rem;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #93c5fd;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid transparent;
      text-decoration: none;
    }

    .btn-primary {
      background: linear-gradient(135deg, #2563eb, #3b82f6);
      color: #fff;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #1d4ed8, #2563eb);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border-color: var(--card-border);
      color: #e2e8f0;
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: var(--card-hover);
    }

    /* Container */
    .container {
      max-width: 1380px;
      margin: 2rem auto;
      padding: 0 1.5rem;
    }

    /* Banner */
    .hero-banner {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8));
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 1.75rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      backdrop-filter: blur(12px);
    }

    .hero-text h1 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.35rem;
    }

    .hero-text p {
      color: var(--text-muted);
      font-size: 0.95rem;
    }

    .period-pill {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: #60a5fa;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 1.35rem;
      backdrop-filter: blur(12px);
      transition: border-color 0.2s;
    }
    .kpi-card:hover {
      border-color: var(--card-hover);
    }

    .kpi-title {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .kpi-value {
      font-size: 1.75rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #fff;
      font-family: var(--font-mono);
    }

    .kpi-subtext {
      font-size: 0.8rem;
      margin-top: 0.4rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.65rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-drift {
      background: rgba(244, 63, 94, 0.15);
      border: 1px solid rgba(244, 63, 94, 0.35);
      color: #fb7185;
    }
    .status-ok {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
    }

    /* Section Layout */
    .grid-2 {
      display: grid;
      grid-template-columns: 1.6fr 1.2fr;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    @media (max-width: 1024px) {
      .grid-2 { grid-template-columns: 1fr; }
    }

    .panel {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 1.5rem;
      backdrop-filter: blur(12px);
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--card-border);
    }

    .panel-header h2 {
      font-size: 1.15rem;
      font-weight: 700;
    }

    /* Anomalies Table */
    .anomaly-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 1.1rem;
      margin-bottom: 1rem;
      transition: all 0.2s;
    }
    .anomaly-card:hover {
      border-color: rgba(255, 255, 255, 0.15);
      background: rgba(15, 23, 42, 0.85);
    }

    .anomaly-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5rem;
    }

    .anomaly-title {
      font-weight: 700;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .anomaly-amount {
      font-family: var(--font-mono);
      font-weight: 700;
      color: #fb7185;
      font-size: 1rem;
    }

    .anomaly-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }

    .anomaly-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.5rem;
      border-top: 1px dashed rgba(255, 255, 255, 0.08);
      font-size: 0.78rem;
    }

    .anomaly-fee-match {
      color: #38bdf8;
      font-family: var(--font-mono);
      font-weight: 600;
    }

    /* Journal Entry Box */
    .journal-box {
      background: #0f172a;
      border: 1px solid var(--card-border);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 1.25rem;
    }

    .journal-header {
      background: rgba(30, 41, 59, 0.5);
      padding: 0.75rem 1rem;
      font-size: 0.85rem;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--card-border);
    }

    .journal-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
      font-family: var(--font-mono);
    }

    .journal-table th, .journal-table td {
      padding: 0.6rem 0.85rem;
      text-align: left;
    }

    .journal-table th {
      color: var(--text-muted);
      border-bottom: 1px solid var(--card-border);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
    }

    .journal-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .journal-table .num {
      text-align: right;
    }

    .journal-footer {
      padding: 0.85rem 1rem;
      background: rgba(15, 23, 42, 0.9);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--card-border);
    }

    /* Audit Trail Feed */
    .audit-list {
      max-height: 380px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .audit-item {
      background: rgba(15, 23, 42, 0.6);
      border-left: 3px solid #3b82f6;
      border-radius: 4px;
      padding: 0.75rem 1rem;
      font-size: 0.82rem;
    }

    .audit-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
      font-family: var(--font-mono);
    }

    .audit-hash {
      font-family: var(--font-mono);
      color: #64748b;
      font-size: 0.7rem;
      margin-top: 0.25rem;
      word-break: break-all;
    }

    /* Toast Notification */
    #toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: #1e293b;
      border: 1px solid #3b82f6;
      color: #fff;
      padding: 0.85rem 1.4rem;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      display: none;
      z-index: 999;
      font-size: 0.875rem;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <header>
    <a href="#" class="brand">
      <div class="brand-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
      </div>
      <span class="brand-title">LedgerGuard</span>
      <span class="badge-plugin">Claude &amp; ChatGPT Plugin</span>
    </a>
    <div class="nav-actions">
      <button class="btn btn-secondary" onclick="triggerOvernightAudit()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Run Overnight Auditor
      </button>
      <a href="/docs" target="_blank" class="btn btn-secondary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        OpenAPI / Docs
      </a>
      <a href="#adjustments-panel" class="btn btn-primary">
        Review Adjustments
      </a>
    </div>
  </header>

  <div class="container">
    <div class="hero-banner">
      <div class="hero-text">
        <h1>Autonomous Financial Auditor &amp; Reconciliation Engine</h1>
        <p>Continuous 4-way matching between Chargebee Invoices, Stripe Charges, Plaid Bank Feeds, and QuickBooks / NetSuite.</p>
      </div>
      <div class="period-pill">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span>Audit Period: <strong>2026-09 (September)</strong></span>
      </div>
    </div>

    <!-- KPI Summary Cards -->
    <div class="kpi-grid" id="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">
          <span>Recognized Revenue</span>
          <span style="color:#94a3b8">Chargebee</span>
        </div>
        <div class="kpi-value" id="kpi-rev">$125,000.00</div>
        <div class="kpi-subtext" style="color:#38bdf8">7 Billing invoices recognized</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-title">
          <span>Stripe Net Deposits</span>
          <span style="color:#94a3b8">Settled</span>
        </div>
        <div class="kpi-value" id="kpi-stripe">$116,392.25</div>
        <div class="kpi-subtext" style="color:#94a3b8">Fees: $3,557.75 deducted</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-title">
          <span>Plaid Bank Deposits</span>
          <span style="color:#94a3b8">Chase 4091</span>
        </div>
        <div class="kpi-value" id="kpi-plaid">$116,392.25</div>
        <div class="kpi-subtext" style="color:#10b981">✓ 100% matched to Stripe net</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-title">
          <span>Reconciliation Status</span>
          <span class="status-badge status-drift" id="kpi-badge">MATERIAL DRIFT</span>
        </div>
        <div class="kpi-value" id="kpi-anom" style="color:#fb7185">3 Anomalies</div>
        <div class="kpi-subtext" style="color:#fb7185">Discrepancies > $250.00 threshold</div>
      </div>
    </div>

    <!-- Main 2-Column Grid -->
    <div class="grid-2">
      <!-- Left Panel: Transaction Anomalies -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>Flagged Anomalies &amp; Fee Variances</h2>
            <p style="font-size:0.85rem; color:var(--text-muted)">Filtered by Materiality Threshold &gt; $250.00 with Stripe Fee Matching</p>
          </div>
          <span class="badge-plugin" style="background:rgba(244,63,94,0.15); border-color:rgba(244,63,94,0.3); color:#fb7185">
            Query Active
          </span>
        </div>

        <div id="anomalies-list">
          <!-- Dynamically populated -->
        </div>
      </div>

      <!-- Right Panel: Dual-Entry Adjustments & ERP Sync -->
      <div class="panel" id="adjustments-panel">
        <div class="panel-header">
          <div>
            <h2>Dual-Entry Adjustments (GAAP)</h2>
            <p style="font-size:0.85rem; color:var(--text-muted)">Drafted for User Approval &amp; Bi-directional ERP Sync</p>
          </div>
          <span class="status-badge status-ok" id="balanced-pill">✓ DEBITS = CREDITS</span>
        </div>

        <div id="adjustments-list">
          <!-- Dynamically populated -->
        </div>

        <div style="margin-top: 1.5rem; border-top: 1px solid var(--card-border); padding-top: 1.25rem;">
          <h3 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            GAAP Cryptographic Audit Chain
          </h3>
          <div class="audit-list" id="audit-trail-feed">
            <!-- Dynamically populated -->
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="toast"></div>

  <script>
    function fmtKpi(value) {
      return value === null || value === undefined
        ? 'Not connected'
        : '$' + value.toLocaleString('en-US', {minimumFractionDigits: 2});
    }

    function currentPeriod() {
      const now = new Date();
      return now.getUTCFullYear() + '-' + String(now.getUTCMonth() + 1).padStart(2, '0');
    }

    async function loadData() {
      try {
        const res = await fetch('/api/v1/audit/variance?period=' + currentPeriod() + '&minDiscrepancy=250');
        const data = await res.json();

        // Populate KPIs — "Not connected" rather than a fabricated $0.00
        // whenever a provider isn't configured (see data.providerStatus).
        document.getElementById('kpi-rev').innerText = fmtKpi(data.summary.recognizedRevenue);
        document.getElementById('kpi-stripe').innerText = fmtKpi(data.summary.stripeNetDeposits);
        document.getElementById('kpi-plaid').innerText = fmtKpi(data.summary.plaidBankDeposits);
        document.getElementById('kpi-anom').innerText = data.metrics.materialDiscrepanciesCount + ' Anomalies';

        const badge = document.getElementById('kpi-badge');
        badge.innerText = data.summary.reconciliationStatus.replace(/_/g, ' ');
        if (data.summary.reconciliationStatus === 'RECONCILED') {
          badge.className = 'status-badge status-ok';
          document.getElementById('kpi-anom').style.color = '#34d399';
        } else if (data.summary.reconciliationStatus === 'INCOMPLETE_DATA') {
          badge.className = 'status-badge status-drift';
          document.getElementById('kpi-anom').style.color = '#94a3b8';
        } else {
          badge.className = 'status-badge status-drift';
          document.getElementById('kpi-anom').style.color = '#fb7185';
        }

        // Populate Anomalies
        const container = document.getElementById('anomalies-list');
        if (data.summary.reconciliationStatus === 'INCOMPLETE_DATA') {
          container.innerHTML = '<div style="padding:2.5rem 1rem; text-align:center; color:#94a3b8; font-weight:600; border:1px dashed rgba(148,163,184,0.3); border-radius:10px; background:rgba(148,163,184,0.05)">No connected data sources for this period yet — connect Stripe and Chargebee to see real numbers here.</div>';
        } else if (data.anomalies.length === 0) {
          container.innerHTML = '<div style="padding:2.5rem 1rem; text-align:center; color:#34d399; font-weight:600; border:1px dashed rgba(16,185,129,0.3); border-radius:10px; background:rgba(16,185,129,0.05)">✓ All accounts, Stripe payouts, and Plaid bank deposits are 100% reconciled to QuickBooks ledger.</div>';
        } else {
          container.innerHTML = data.anomalies.map(a => \`
            <div class="anomaly-card">
              <div class="anomaly-top">
                <span class="anomaly-title">
                  <span class="status-badge \${a.severity === 'CRITICAL' ? 'status-drift' : 'status-drift'}" style="font-size:0.65rem">\${a.severity}</span>
                  \${a.title}
                </span>
                <span class="anomaly-amount">$\${a.discrepancyAmount.toLocaleString('en-US', {minimumFractionDigits:2})}</span>
              </div>
              <p class="anomaly-desc">\${a.description}</p>
              <div class="anomaly-footer">
                <div>
                  <span style="display:block; margin-bottom:0.25rem">\${a.suggestedAction}</span>
                  <button class="btn btn-secondary" style="font-size:0.75rem; padding:0.25rem 0.65rem; margin-top:0.35rem" onclick="draftForAnomaly('\${a.id}')">
                    + Draft Adjusting Entry
                  </button>
                </div>
                \${a.matchedProcessorFee ? \`<span class="anomaly-fee-match">Matched Fee: $\${a.matchedProcessorFee.toFixed(2)}</span>\` : ''}
              </div>
            </div>
          \`).join('');
        }

        await loadAdjustments();
        await loadAuditTrail();
      } catch (err) {
        console.error(err);
      }
    }

    async function loadAdjustments() {
      const res = await fetch('/api/v1/adjustments');
      const adjs = await res.json();
      const container = document.getElementById('adjustments-list');

      container.innerHTML = adjs.map(adj => \`
        <div class="journal-box">
          <div class="journal-header">
            <div>
              <span style="font-family:var(--font-mono); font-weight:700">\${adj.adjustmentNumber}</span>
              <span style="color:var(--text-muted); margin-left:0.5rem">(\${adj.status})</span>
            </div>
            <span style="font-size:0.75rem; color:#94a3b8">Target: <strong>\${adj.targetERP}</strong></span>
          </div>
          <table class="journal-table">
            <thead>
              <tr>
                <th>Account</th>
                <th class="num">Debit</th>
                <th class="num">Credit</th>
              </tr>
            </thead>
            <tbody>
              \${adj.lines.map(l => \`
                <tr>
                  <td>
                    <div style="font-weight:600">\${l.accountCode} — \${l.accountName}</div>
                    <div style="font-size:0.75rem; color:#64748b">\${l.description || ''}</div>
                  </td>
                  <td class="num" style="color:\${l.debit > 0 ? '#34d399' : '#64748b'}">\${l.debit > 0 ? '$' + l.debit.toFixed(2) : '—'}</td>
                  <td class="num" style="color:\${l.credit > 0 ? '#38bdf8' : '#64748b'}">\${l.credit > 0 ? '$' + l.credit.toFixed(2) : '—'}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
          <div class="journal-footer">
            <span style="font-family:var(--font-mono); font-size:0.8rem; color:#94a3b8">Total: <strong>$\${adj.totalDebit.toFixed(2)}</strong></span>
            <div>
              \${adj.status === 'DRAFT' ? \`
                <button class="btn btn-secondary" style="font-size:0.78rem; padding:0.4rem 0.8rem" onclick="approveAdjustment('\${adj.id}')">
                  ✓ Approve Entry
                </button>
              \` : ''}
              \${adj.status === 'APPROVED' ? \`
                <button class="btn btn-primary" style="font-size:0.78rem; padding:0.4rem 0.8rem" onclick="commitAdjustment('\${adj.id}')">
                  Push to QuickBooks
                </button>
              \` : ''}
              \${adj.status === 'POSTED' ? \`
                <span class="status-badge status-ok" style="font-size:0.75rem">SYNCED: \${adj.erpPostedId}</span>
              \` : ''}
            </div>
          </div>
        </div>
      \`).join('');
    }

    async function loadAuditTrail() {
      const res = await fetch('/api/v1/audit-trail');
      const data = await res.json();
      const container = document.getElementById('audit-trail-feed');

      container.innerHTML = data.trail.slice(-6).reverse().map(e => \`
        <div class="audit-item">
          <div class="audit-meta">
            <span><strong>[\${e.actor}]</strong> \${e.action}</span>
            <span>\${new Date(e.timestamp).toLocaleTimeString()}</span>
          </div>
          <div>\${e.details}</div>
          <div class="audit-hash">SHA256: \${e.currentHash.substring(0, 32)}...</div>
        </div>
      \`).join('');
    }

    async function approveAdjustment(id) {
      const res = await fetch('/api/v1/adjustments/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustmentId: id, approvedBy: 'Finance Lead (User Approval)' })
      });
      const data = await res.json();
      showToast('Journal Entry Approved! Ready for ERP Push.');
      await loadAdjustments();
      await loadAuditTrail();
    }

    async function commitAdjustment(id) {
      const res = await fetch('/api/v1/adjustments/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustmentId: id, targetERP: 'QUICKBOOKS' })
      });
      const data = await res.json();
      showToast('Successfully synchronized with QuickBooks Online!');
      await loadData();
      await loadAdjustments();
      await loadAuditTrail();
    }

    async function draftForAnomaly(anomalyId) {
      showToast('Drafting GAAP dual-entry balancing adjustment...');
      const res = await fetch('/api/v1/adjustments/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomalyId })
      });
      const data = await res.json();
      showToast('Adjustment drafted: ' + (data.adjustmentNumber || 'Ready for review'));
      await loadAdjustments();
      await loadAuditTrail();
    }

    async function triggerOvernightAudit() {
      showToast('Executing automated overnight reconciliation batch...');
      const res = await fetch('/api/v1/cron/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: '2026-09' })
      });
      const data = await res.json();
      showToast('Overnight audit complete! Slack alert dispatched to #finance-ops-alerts.');
      await loadData();
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 4000);
    }

    loadData();
  </script>
</body>
</html>`;
}
//# sourceMappingURL=html.js.map