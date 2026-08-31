---
name: web-security
description: Auditing and hardening a web application - injection, XSS and output encoding, CSRF, SSRF, broken access control, insecure deserialization, dependency risk, security headers and CSP, secret handling and rate limiting. Use when reviewing a web application for vulnerabilities, before a release that touches accounts or payments, or when hardening an inherited codebase. Written as an audit procedure, not a lecture.
license: MIT
metadata:
  uad-layer: platform
  uad-platform: web
  uad-domain: security
  uad-version: "1.0.0"
  uad-requires: "secure-coding, client-server-trust, threat-modeling"
  uad-tags: "web security, xss, injection, csrf, ssrf, access control, csp, headers, owasp, audit, rate limiting"
  uad-maturity: stable
---

# Web Security

## Purpose

An audit procedure for a web application, ordered by what actually gets
exploited rather than by what is interesting. The general principles are in
`secure-coding` and `client-server-trust`; this skill is the web-specific
surface and a checklist you can walk a codebase against.

The single most valuable finding in most web applications is **broken access
control** — an endpoint that authenticates the caller and then does not check
whether they may act on the thing they named. It is more common than injection,
easier to exploit, and routinely missed because the UI never offers the action.

## When to use

- Auditing a web application, whether yours or inherited.
- Before a release touching accounts, payments, or personal data.
- After a dependency audit reports something.
- When adding an endpoint that accepts user-controlled identifiers.
- Investigating suspicious activity.

## When NOT to use

- Sign-in, sessions and password handling specifically. Use `web-authentication`.
- Deciding what is worth defending. Use `threat-modeling` first, or you will
  harden uniformly and misallocate effort.
- Infrastructure and network security, which is a different discipline.
- Producing exploit tooling. Findings and fixes for a system you own or are
  authorised to test are the deliverable.

## Required context

| Fact | Why it matters | Where to find it |
|---|---|---|
| Framework and versions installed | Vulnerabilities and defaults are version-specific | **The lockfile**, not the manifest |
| Which endpoints accept user-controlled ids | Where access-control failures live | Route definitions |
| Where user content is rendered | XSS surface | Templates and components |
| Whether the server makes outbound requests from user input | SSRF surface | Fetch and HTTP client calls |
| Session mechanism | Decides CSRF applicability | `web-authentication` |
| What the application actually protects | Ranks everything | `threat-modeling` |

## Version constraints

Everything about findings is version-specific. A vulnerability applies to a
version range; a framework's escaping and cookie defaults change across majors;
a header recommendation is revised over time. **Audit the lockfile**, which
records what is installed — auditing the manifest's ranges audits software you
may not be running.

Where no lockfile exists, that is itself a finding: builds are not reproducible,
and no audit of them means anything.

## Workflow

Work in this order. It is ordered by expected value, not by taxonomy.

1. **Broken access control — check this first.** For every endpoint accepting an
   identifier, confirm the server verifies the authenticated user may act on
   that object. Then test it: authenticate as user A and request user B's
   resource by id. It must be denied.

   Also check for privilege escalation through mass assignment: a request body
   containing `role`, `isAdmin` or `accountId` that the server binds to a model
   without an allow-list.

   Hiding an action in the UI is not an access control. The API is what an
   attacker calls.

2. **Injection.** Every injection is one bug: a value crossing into a language
   where it is read as syntax. Identify the interpreter each value reaches, and
   confirm structural separation is used rather than string building:

   | Interpreter | Correct approach |
   |---|---|
   | SQL | Parameterised queries; never concatenation, never template literals |
   | Shell | Argument arrays; never a single command string |
   | HTML | The framework's escaping, or DOM APIs |
   | Path | Path-joining plus a containment check after normalising |
   | NoSQL | Reject operator objects where a scalar is expected |

   Grep for concatenation near query and process-spawn calls.

3. **XSS.** Modern frameworks escape by default, so look for the escape hatches:
   `dangerouslySetInnerHTML`, `v-html`, `innerHTML`, `{@html}`, and any
   server-side template marked raw. Each one is a decision that needs
   justification, and user content reaching one needs sanitising with a
   maintained sanitiser — not a regex.

   Also check URL sinks: a user-controlled `href` accepting `javascript:` is XSS.

4. **CSRF.** Applies when the session travels automatically — cookies. Confirm
   `SameSite` is set, and that state-changing requests additionally carry a CSRF
   token or are otherwise protected. `SameSite=Lax` covers a great deal but is
   not a complete substitute. Requests using an `Authorization` header are not
   CSRF-exposed in the same way, because the browser does not attach it for you.

   State-changing operations must not be `GET`.

5. **SSRF.** Does the server fetch a URL derived from user input — webhooks,
   image imports, link previews? If so, an attacker can point it at internal
   services and cloud metadata endpoints. Use an allow-list of destinations,
   resolve and validate the address, block private ranges, and do not follow
   redirects blindly.

6. **Insecure deserialization and unsafe parsing.** Treat deserialisation of
   attacker-supplied data into arbitrary types as code execution. Prefer
   data-only formats with schema validation. Cap request body size, JSON depth
   and array length — unbounded parsing is a denial-of-service bug.

7. **Secrets.** Scan the repository **and its history**. Anything ever committed
   is disclosed and must be **rotated**, not deleted. Confirm nothing secret is
   in client-shipped code — anything in a bundle is public, including values in
   client-side environment variables. Check that error responses and logs do not
   contain secrets.

8. **Security headers.** `curl -I` the application and read them:

   | Header | Purpose |
   |---|---|
   | `Content-Security-Policy` | The strongest structural XSS mitigation |
   | `Strict-Transport-Security` | Forces HTTPS |
   | `X-Content-Type-Options: nosniff` | Stops MIME sniffing |
   | `Referrer-Policy` | Limits URL leakage |
   | `X-Frame-Options` / CSP `frame-ancestors` | Clickjacking |

   A CSP that permits `unsafe-inline` for scripts is providing far less than it
   appears to.

9. **Dependencies.** Run the ecosystem's audit against the lockfile. Triage by
   whether the vulnerable path is reachable in your usage, not by severity alone.

10. **Rate limiting and resource limits.** Authentication, password reset, search,
    file upload, and anything expensive. Confirm limits are enforced server-side
    and keyed to something the client cannot choose.

11. **Error handling.** Trigger a failure and read the response: no stack trace,
    no framework banner, no database text. Detail goes to the log with a
    correlation id.

## Best practices

- **Follow the value.** Audit what an attacker would want first.
- **Prefer structural elimination to filtering.** Parameterised queries beat
  escaping; a CSP beats sanitising; data you do not store cannot leak.
- **Validate at the boundary with an allow-list**, once, thoroughly.
- **Make the secure path the easy path** — a helper that is safe by
  construction, so the unsafe alternative is never reached for under deadline.
- **Check authorization at the data access layer**, close to the resource.
- **Log security events** with actor and outcome, never with the credential.
- **Automate what you can** — dependency audit, secret scanning, static analysis
  and a header check in CI — and spend human attention on access control, which
  no tool understands.
- **State your scope**, including what you did not examine.

## Common mistakes

- **Authorization checked in the UI or in routing only.**
- **Object ids trusted because they came from a page you rendered.** The
  attacker edits them.
- **Mass assignment** binding a request body straight onto a model.
- **String-built SQL**, especially in "just this one internal admin query".
- **Sanitising with a regex or a deny-list.** Reliably incomplete.
- **`dangerouslySetInnerHTML` with user content** and no sanitiser.
- **Secrets in client-side environment variables**, believing they are private.
- **Deleting a committed secret instead of rotating it.**
- **A CSP with `unsafe-inline`**, which removes most of its value.
- **Auditing `package.json` instead of the lockfile.**
- **No rate limiting**, because the UI does not allow rapid calls.
- **Verbose errors in production.**
- **Treating a passing dependency audit as a security review.** It checks known
  vulnerabilities in other people's code, and nothing about yours.

## Validation

Every item is a command or a test, not a judgement:

- [ ] **Access control:** authenticated as A, request B's resource by id →
      denied. Repeat for every endpoint taking an id.
- [ ] **Mass assignment:** POST an extra `role` or `isAdmin` field → ignored.
- [ ] **Injection:** `grep` for concatenation near query and spawn calls → none.
- [ ] **XSS:** `grep -rn "dangerouslySetInnerHTML\|v-html\|innerHTML\|{@html}"`
      → each occurrence justified and sanitised.
- [ ] **CSRF:** replay a state-changing request from another origin → rejected.
- [ ] **SSRF:** submit a URL pointing at a private address or metadata endpoint
      → rejected.
- [ ] **Headers:** `curl -I https://the-app` → CSP, HSTS, nosniff,
      Referrer-Policy, frame protection all present.
- [ ] **Secrets:** a secret scanner over the full history → clean.
- [ ] **Dependencies:** audit against the lockfile → clean, or every finding
      triaged with a date and owner.
- [ ] **Errors:** force a 500 → generic message, no stack trace.
- [ ] **Limits:** hammer sign-in and an expensive endpoint → throttled.
- [ ] **Body limits:** post an oversized body and a deeply nested JSON document
      → rejected, not hung.

Then state what was **not** covered. An audit with unstated scope is read as
coverage it never had, which is a way to cause harm rather than prevent it.

## References

- Related platform skills: `web-authentication`, `web-backend-architecture`,
  `web-project-conventions`
- Related core skills: `secure-coding`, `client-server-trust`, `threat-modeling`,
  `code-review-method`
- Authoritative and kept current: OWASP Top Ten and the OWASP Cheat Sheet
  Series — https://cheatsheetseries.owasp.org
