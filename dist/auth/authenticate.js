// Resolves an incoming request's Bearer access token to the userId
// (accountId) it was issued for. Opaque token, so this is one indexed
// lookup through the Postgres adapter — see oidc-provider.ts for why
// that's preferred here over configuring JWT access tokens.
export async function resolveUserIdFromBearer(provider, req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        return null;
    const token = auth.slice('Bearer '.length).trim();
    if (!token)
        return null;
    // provider.AccessToken is a real public instance property (oidc-provider
    // exposes every model class this way) that the community @types
    // package doesn't declare — hence the cast.
    const AccessToken = provider.AccessToken;
    const accessToken = await AccessToken.find(token);
    if (!accessToken || accessToken.isExpired || !accessToken.accountId)
        return null;
    return accessToken.accountId;
}
//# sourceMappingURL=authenticate.js.map