---
name: web-authentication
description: Building authentication for web applications - sessions versus tokens, cookie attributes, password storage, OAuth and OIDC flows, multi-factor authentication, session lifecycle and revocation, and authorization as a separate concern. Use when implementing sign-in, adding a social login, handling password reset, or auditing an existing auth flow. Never invent cryptography; this skill directs you to vetted libraries.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: web
  uad-domain: security
  uad-version: "1.0.0"
  uad-requires: "client-server-trust, threat-modeling, secure-coding"
  uad-tags: "authentication, login, session, cookie, jwt, oauth, oidc, password, mfa, authorization, csrf"
  uad-maturity: stable
---

# Web Authentication

## Purpose

Authentication is the part of a web application where mistakes are most
expensive and most tempting to hand-roll. It is also the area where the correct
answer is most often "use the vetted library", and where the failures are
depressingly consistent: passwords hashed with a fast digest, tokens that cannot
be revoked, cookies missing an attribute, and authorization confused with
authentication.

**Do not invent cryptography, token formats, or password hashing.** Use an
established library or an identity provider. This skill is about making the
right choices around them.

## When to use

- Implementing sign-up, sign-in, sign-out, or password reset.
- Adding social login or single sign-on.
- Auditing an existing authentication flow.
- Deciding between sessions and tokens.
- Adding multi-factor authentication.
- Investigating account takeover or session-related reports.

## When NOT to use

- The broader vulnerability surface. Use `web-security`.
- Deciding what to defend at all. Use `threat-modeling`.
- Machine-to-machine API credentials, which are a different problem with
  different lifetimes and no human in the loop.
- Non-web platforms. `roblox-security` and `client-server-trust` cover the
  equivalent trust questions elsewhere.

## Required context

| Fact | Why it matters | Where to find it |
|---|---|---|
| Framework and its version | Auth libraries and their defaults are framework- and version-specific | `package.json` **and the lockfile** |
| Whether an auth library or provider is already in use | Adding a second auth path is how gaps appear | Dependencies, existing routes |
| First-party only, or third-party clients too | Decides whether cookies are viable | The architecture |
| Whether the frontend and API share a site | Cross-site changes every cookie decision | Deployment topology |
| Regulatory obligations | Some controls are not optional | Product requirements |
| Whether users can be forced to sign out | Determines the session strategy | The requirement |

## Version constraints

Framework auth integrations change across majors — cookie handling, middleware
APIs, server-side session helpers and the recommended patterns all move. Read
the installed versions from the lockfile, not the ranges in the manifest, and
check the library's own migration notes.

Cryptographic recommendations also change over time: parameters considered
adequate for password hashing are revised as hardware improves. Take current
parameters from the library's documentation or OWASP guidance rather than from
a number remembered here.

## Workflow

1. **Decide who is responsible for identity.** Delegating to an identity
   provider (OIDC) removes most of this skill's surface, and for many products
   that is the right answer. Owning it yourself is justified when you need
   control the provider will not give you — and it is a permanent commitment,
   not a one-off implementation.

2. **Choose sessions or tokens deliberately.**

   | | Server-side session + cookie | Self-contained token (JWT) |
   |---|---|---|
   | Revocation | Immediate — delete the record | Hard; the token stays valid until it expires |
   | State | Server keeps it | Stateless |
   | Best for | First-party web apps | Cross-service auth, short-lived access tokens |
   | Main risk | Session store availability | **Cannot log anyone out** |

   For a first-party web application, **server-side sessions with a cookie are
   usually correct** and are what most auth libraries default to. Reach for
   self-contained tokens when statelessness genuinely buys something, and pair
   them with short expiry plus a refresh token you *can* revoke.

   The revocation question is the one that decides it: if you cannot answer
   "how do we sign out a compromised account right now", you have chosen wrong.

3. **Set cookie attributes completely.** Every one of these matters:

   - `HttpOnly` — inaccessible to JavaScript, so an XSS bug cannot read it.
   - `Secure` — HTTPS only.
   - `SameSite` — `Lax` is a sound default; `Strict` where no cross-site
     navigation must carry the session; `None` **only** with `Secure` and a
     deliberate reason, since it re-opens CSRF exposure.
   - `Path` and a sensible expiry.
   - A `__Host-` prefix where applicable, which binds the cookie to the exact
     host and path.

   **Do not store tokens in `localStorage`.** It is readable by any script on
   the page, which turns any XSS into full account takeover. This is the single
   most common serious mistake in modern web auth, and the reasoning that leads
   to it — "cookies have CSRF problems" — is solved by `SameSite` and CSRF
   tokens, not by moving the credential somewhere scriptable.

4. **Store passwords with a memory-hard hash.** Argon2id where available,
   otherwise scrypt or bcrypt. Never a plain digest such as SHA-256 — fast
   hashes are exactly what an attacker with a stolen database wants. The library
   handles salting; do not implement it yourself. Take current cost parameters
   from the library's guidance.

5. **Make authentication responses uniform.** Sign-in failure must not reveal
   whether the account exists, and neither must password reset or sign-up. Use
   the same message and comparable timing.

6. **Rate limit and lock out.** Per-account and per-IP limits on sign-in,
   password reset and MFA verification. Without them, credential stuffing is
   simply a matter of time.

7. **Handle the session lifecycle properly.**
   - **Regenerate the session identifier on privilege change** — on sign-in
     above all. Failing to do this is session fixation.
   - Absolute and idle timeouts.
   - Sign-out invalidates server-side, not merely by clearing the cookie.
   - Offer "sign out everywhere", and use it after a password change.

8. **Implement password reset as a single-use, short-lived, high-entropy
   token**, stored hashed, invalidated on use, and always responding uniformly
   whether or not the address exists. Reset must invalidate existing sessions.

9. **Add MFA where the stakes justify it.** TOTP or WebAuthn; SMS is weak
   against SIM swapping and should not be the only factor for a valuable
   account. Generate recovery codes, store them hashed, and rate limit
   verification.

10. **Treat authorization as a separate concern.** Knowing *who* is calling does
    not establish *what they may do*. Check permission per action, against
    server-side state, on every request. An authenticated user requesting
    another user's record is the most common access-control failure there is.

## Best practices

- **Use a vetted auth library or provider.** Hand-rolled auth is how the
  well-known failures happen.
- **Check permission at the data access boundary**, not in the UI and not only
  in routing, where it drifts.
- **Log authentication events** — sign-in success and failure, password change,
  MFA change, sign-out-everywhere — with actor and source, never with the
  credential.
- **Use constant-time comparison** for any secret comparison, and a CSPRNG for
  every token. Never `Math.random`, a timestamp, or an incrementing id.
- **Keep sessions short and refresh them**, rather than issuing long-lived
  credentials you cannot withdraw.
- **Send the security headers** that support auth: HSTS, and a CSP that
  meaningfully constrains script, since XSS is the usual route to session theft.
- **Require re-authentication for sensitive actions** — changing email,
  password, or MFA.
- **Test the negative paths.** Most auth bugs are in the flows nobody demos.

## Common mistakes

- **Tokens in `localStorage`.** Any XSS becomes account takeover.
- **A fast hash for passwords**, or a hand-written salting scheme.
- **No session regeneration on sign-in.** Session fixation.
- **Sign-out that only clears the cookie**, leaving the session valid server-side.
- **Self-contained tokens with no revocation path**, so a compromised account
  cannot be signed out.
- **Different responses for "no such user" and "wrong password".** Account
  enumeration.
- **No rate limiting** on sign-in, reset, or MFA verification.
- **Password reset tokens that are long-lived, reusable, or stored in plaintext.**
- **Confusing authentication with authorization** — a signed-in user is not an
  authorised one.
- **Checking permissions in the UI only.** The API is what the attacker calls.
- **`SameSite=None`** set to make something work, without understanding the
  CSRF exposure reintroduced.
- **Trusting a client-supplied user id** instead of the authenticated identity.

## Validation

Run these; do not assert them:

- [ ] `curl -I` a signed-in response and read the `Set-Cookie` — `HttpOnly`,
      `Secure` and `SameSite` all present.
- [ ] No credential appears in `localStorage` or `sessionStorage` — check in the
      browser's storage inspector, not by reading the code.
- [ ] The session identifier **changes** after sign-in. Compare before and after.
- [ ] Sign out, then replay the old cookie against a protected endpoint — it
      must be rejected.
- [ ] Sign-in with a non-existent account and with a wrong password return the
      same message, in comparable time.
- [ ] Repeated failed sign-ins are rate limited or locked out.
- [ ] A password reset token cannot be reused, and expires.
- [ ] Changing the password invalidates other sessions.
- [ ] **Request another user's resource by id while authenticated as yourself.**
      It must be denied. This is the highest-value single test in the list.
- [ ] Password hashes in the database are from a memory-hard algorithm — inspect
      one and check the prefix.
- [ ] A dependency audit against the lockfile reports no known-vulnerable auth
      library.

## References

- Related platform skills: `web-security`, `web-backend-architecture`,
  `web-project-conventions`
- Related core skills: `client-server-trust`, `threat-modeling`, `secure-coding`
- Authoritative and kept current: OWASP Authentication and Session Management
  Cheat Sheets — https://cheatsheetseries.owasp.org
