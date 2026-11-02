import { ConnectedProvider } from './connected-accounts.js';

function shell(title: string, body: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — LedgerGuard</title>
<style>
  body { background:#090d16; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:rgba(18,26,43,0.9); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:2.5rem; max-width:420px; width:90%; text-align:center; }
  h1 { font-size:1.1rem; margin:0 0 1.25rem; }
  label { display:block; text-align:left; font-size:0.8rem; color:#94a3b8; margin-bottom:0.3rem; }
  input { width:100%; box-sizing:border-box; padding:0.65rem 0.8rem; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:#0f172a; color:#f8fafc; font-size:0.9rem; margin-bottom:0.9rem; font-family:monospace; }
  button { width:100%; padding:0.7rem; border-radius:8px; border:none; background:#3b82f6; color:white; font-weight:600; font-size:0.9rem; cursor:pointer; }
  p { color:#94a3b8; font-size:0.85rem; line-height:1.5; }
  a { color:#38bdf8; }
  .status { display:inline-block; padding:0.2rem 0.6rem; border-radius:999px; font-size:0.75rem; font-weight:600; margin-bottom:1rem; }
  .status.CONNECTED { background:rgba(34,197,94,0.15); color:#4ade80; }
  .status.NOT_CONFIGURED { background:rgba(148,163,184,0.15); color:#94a3b8; }
  .status.ERROR { background:rgba(239,68,68,0.15); color:#f87171; }
  .status.REVOKED { background:rgba(148,163,184,0.15); color:#94a3b8; }
</style>
</head>
<body><div class="card">${body}</div></body>
</html>`;
}

const PROVIDER_LABEL: Record<ConnectedProvider, string> = {
	STRIPE: 'Stripe',
	CHARGEBEE: 'Chargebee',
	PLAID: 'Plaid',
	QUICKBOOKS: 'QuickBooks',
	PAYSTACK: 'PayStack',
	PAYPAL: 'PayPal',
	SQUARE: 'Square',
	BRAINTREE: 'Braintree',
	PADDLE: 'Paddle',
};

export function connectFormPage(
	provider: ConnectedProvider,
	status: 'NOT_CONFIGURED' | 'CONNECTED' | 'ERROR' | 'REVOKED',
): string {
	const label = PROVIDER_LABEL[provider];
	const accountIdField =
		provider === 'CHARGEBEE'
			? `<label for="accountId">Chargebee site name</label>
			   <input type="text" id="accountId" name="accountId" placeholder="mycompany" required>`
			: '';

	return shell(`Connect ${label}`, `
		<h1>🔌 Connect ${label}</h1>
		<span class="status ${status}">${status.replace(/_/g, ' ')}</span>
		<p>Your key is stored encrypted and only ever used to read your own ${label} data. It's never shown to the AI assistant — only you see it here.</p>
		<form method="POST" action="/connect/${provider.toLowerCase()}">
			${accountIdField}
			<label for="apiKey">${label} API key</label>
			<input type="password" id="apiKey" name="apiKey" placeholder="${provider === 'STRIPE' ? 'sk_test_...' : 'full_access_key'}" required autofocus>
			<button type="submit">${status === 'CONNECTED' ? 'Update key' : 'Connect'}</button>
		</form>
		<p><a href="/">&larr; Back to dashboard</a></p>
	`);
}
