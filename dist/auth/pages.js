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
export function emailFormPage(actionUrl, next) {
    return shell('Sign in', `
		<h1>🛡️ Sign in to LedgerGuard</h1>
		<form method="POST" action="${actionUrl}">
			${next ? `<input type="hidden" name="next" value="${next.replace(/"/g, '&quot;')}">` : ''}
			<input type="email" name="email" placeholder="you@company.com" required autofocus>
			<button type="submit">Send sign-in code</button>
		</form>
		<p>No password — we'll email you a 6-digit code instead.</p>
	`);
}
// No clickable link here on purpose — a link that completes sign-in on
// load is exactly what mail security gateways (Safe Links, Proofpoint,
// Mimecast-style sandboxes) and some senders' own click-tracking are
// built to visit automatically, which silently burns a single-use
// credential before the real recipient ever sees it. A code the person
// types in by hand has no URL for anything automated to act on.
// challengeId travels as a hidden field when the action URL doesn't
// already encode it (the OAuth interaction flow's /interaction/:uid/code
// doesn't need one, since :uid already scopes it).
export function codeEntryPage(email, actionUrl, challengeId, next) {
    return shell('Enter your code', `
		<h1>🔢 Enter your code</h1>
		<p>We emailed a 6-digit code to <strong>${email.replace(/</g, '&lt;')}</strong>. It expires in 10 minutes and works once.</p>
		<form method="POST" action="${actionUrl}">
			${challengeId ? `<input type="hidden" name="challengeId" value="${challengeId.replace(/"/g, '&quot;')}">` : ''}
			${next ? `<input type="hidden" name="next" value="${next.replace(/"/g, '&quot;')}">` : ''}
			<input type="text" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="123456" required autofocus style="text-align:center;letter-spacing:4px;font-size:1.3rem;">
			<button type="submit">Verify</button>
		</form>
	`);
}
export function errorPage(message) {
    return shell('Error', `
		<h1>Something went wrong</h1>
		<p>${message.replace(/</g, '&lt;')}</p>
	`);
}
//# sourceMappingURL=pages.js.map