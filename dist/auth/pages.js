function shell(title, body) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — LedgerGuard</title>
<style>
  body { background:#090d16; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .card { background:rgba(18,26,43,0.9); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:2.5rem; max-width:380px; width:90%; text-align:center; }
  h1 { font-size:1.1rem; margin:0 0 1.25rem; }
  input { width:100%; box-sizing:border-box; padding:0.65rem 0.8rem; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:#0f172a; color:#f8fafc; font-size:0.9rem; margin-bottom:0.9rem; }
  button { width:100%; padding:0.7rem; border-radius:8px; border:none; background:#3b82f6; color:white; font-weight:600; font-size:0.9rem; cursor:pointer; }
  p { color:#94a3b8; font-size:0.85rem; line-height:1.5; }
  a { color:#38bdf8; }
</style>
</head>
<body><div class="card">${body}</div></body>
</html>`;
}
export function emailFormPage(actionUrl) {
    return shell('Sign in', `
		<h1>🛡️ Sign in to LedgerGuard</h1>
		<form method="POST" action="${actionUrl}">
			<input type="email" name="email" placeholder="you@company.com" required autofocus>
			<button type="submit">Send sign-in link</button>
		</form>
		<p>No password — we'll email you a one-time link instead.</p>
	`);
}
export function checkEmailPage(email) {
    return shell('Check your email', `
		<h1>✉️ Check your email</h1>
		<p>We sent a sign-in link to <strong>${email.replace(/</g, '&lt;')}</strong>. It expires in 15 minutes and works once.</p>
	`);
}
export function errorPage(message) {
    return shell('Error', `
		<h1>Something went wrong</h1>
		<p>${message.replace(/</g, '&lt;')}</p>
	`);
}
//# sourceMappingURL=pages.js.map