---
name: secure-coding
description: Implementation-level defensive practice - validating input at boundaries, handling secrets, avoiding injection, safe error handling, dependency hygiene, and safe defaults. Use while writing or reviewing code that parses external input, builds queries or commands, handles credentials or tokens, serialises data, or manages permissions. Complements threat-modeling, which decides what to defend, by covering how to implement the defence.
license: MIT
metadata:
  uad-layer: core
  uad-platform: any
  uad-domain: security
  uad-version: "1.0.0"
  uad-requires: "client-server-trust"
  uad-tags: "security, injection, validation, secrets, sanitisation, dependencies, safe defaults, error handling"
  uad-maturity: stable
---

# Secure Coding

## Purpose

`threat-modeling` decides what to defend and `client-server-trust` decides where
authority lives. This skill is the implementation layer: the coding practices
that stop a correct design from being undermined by the code that implements it.

Most exploited vulnerabilities are not exotic. They are a string concatenated
into a query, a secret in a config file, an error message that reveals internal
structure, or a dependency nobody updated.

## When to use

- Writing or reviewing code that reads external input: network, files, user
  fields, configuration, environment.
- Building any command, query, path, URL, or markup from values.
- Handling credentials, tokens, keys, or personal data.
- Deserialising data from anywhere you do not fully control.
- Implementing permission checks.
- Adding or upgrading a dependency.

## When NOT to use

- Deciding *which* threats matter. Use `threat-modeling` first, or you will
  harden uniformly and misallocate effort.
- Designing authority placement. Use `client-server-trust`.
- Designing cryptographic protocols or primitives. Use vetted libraries; if the
  design genuinely requires new cryptography, it requires a specialist.

## Required context

| Fact | Why it matters |
|---|---|
| Which inputs are attacker-controlled | Everything crossing a trust boundary is |
| Which interpreter each value reaches | SQL, shell, HTML, path, and template each need different handling |
| Where secrets currently live | Config files and source control are the usual leaks |
| The language and framework's own protections | Use them rather than reimplementing |
| Installed dependency versions | Vulnerabilities are version-specific; read the lockfile |

## Version constraints

The principles are stable; the correct API is not. Escaping helpers,
parameterised query APIs, cryptographic defaults and security header
recommendations change between framework versions, and defaults occasionally
become *less* safe. Confirm the mechanism in the version the project uses, and
when a library offers a safe API, prefer it to hand-rolled escaping — the
library tracks the interpreter's rules and your code will not.

## Workflow

1. **Identify the interpreter.** Every injection is the same bug: a value
   crossing into a language where it is read as syntax. Before handling a value,
   name what will parse it -- SQL, shell, HTML, a path resolver, a template, a
   regular expression, a serialiser.

2. **Use structural separation, not escaping**, wherever the platform offers it:
   parameterised queries, argument arrays for process spawning, DOM APIs rather
   than string HTML, path-joining APIs with containment checks. Escaping is the
   fallback when no structural option exists, and it must be the escaping
   function belonging to that exact interpreter.

3. **Validate at the boundary against an allow-list.** Define what is
   acceptable and reject everything else. Deny-lists fail because the space of
   bad input is unbounded. Validate type, length, range, format, and membership.

4. **Normalise before validating, and validate the normalised value.**
   Otherwise checks are bypassed with alternate encodings, unicode
   look-alikes, or `..` path segments.

5. **Handle secrets properly.** Never in source control, never in client-shipped
   code, never in log output, never in error messages or URLs. Load from
   environment or a secret manager. Assume anything committed once is
   permanently disclosed and must be rotated, not deleted.

6. **Fail closed and fail quietly outward.** On error, deny. Return a generic
   message to the caller and log the detail internally, with a correlation id.
   Stack traces and database errors returned to users are reconnaissance.

7. **Set safe defaults.** The secure option is the one you get by doing nothing:
   authentication required unless explicitly public, least privilege, deny by
   default, TLS on, secure cookie attributes set.

8. **Treat deserialisation as code execution** unless proven otherwise. Prefer
   data-only formats with schema validation; never deserialise attacker-supplied
   data into arbitrary types.

9. **Keep dependencies current and few.** Every dependency is code you ship and
   did not review. Pin with a lockfile, audit regularly, and remove what is
   unused.

## Best practices

- **Validate once at the boundary, thoroughly**, then treat data as trusted
  inside the boundary.
- **Prefer the framework's mechanism** over a hand-written equivalent; it is
  maintained and reviewed.
- **Keep permission checks close to the resource**, not scattered in the UI or
  routing layer where they drift.
- **Make the secure path the easy path.** Provide a helper that is safe by
  construction; unsafe alternatives will otherwise be used under deadline.
- **Log security-relevant events** -- authentication outcomes, permission
  denials, validation rejections -- with the actor, never with the secret.
- **Cap everything.** Request size, string length, collection size, recursion
  depth, execution time. Unbounded is a denial-of-service waiting to be found.
- **Use constant-time comparison for secrets**, and generate tokens from a
  cryptographically secure random source, never from `rand`, a timestamp, or an
  incrementing id.

## Common mistakes

- **String concatenation into a query, command, or markup.** The single most
  exploited class of bug.
- **Sanitising with a deny-list or a regex.** Reliably incomplete.
- **Validating on the client only.** It is a UX feature; the attacker skips it.
- **Secrets in source control.** Rotate; do not merely delete the line.
- **Verbose errors to the caller.** Free internal documentation for an attacker.
- **Catching and ignoring exceptions.** Turns a failed security check into a
  silently passed one.
- **Rolling your own cryptography, tokens, or password hashing.** Use the
  vetted library; use a memory-hard password hash, never a plain digest.
- **Trusting a filename, path, redirect target, or content type from input.**
  All are attacker-controlled.
- **Leaving debug endpoints, verbose logging, or default credentials in a
  shipped build.**
- **Unbounded input.** No length or size cap is a resource-exhaustion bug.

## Validation

Verifiable checks; run them rather than asserting them:

- [ ] Every external input reaches a validator before use, and the validator is
      an allow-list.
- [ ] No query, command, path, or markup is built by concatenating a value.
      Grep for concatenation near query and process-spawn APIs.
- [ ] A secret scanner over the repository *and its history* reports nothing.
- [ ] Error responses carry no stack trace, framework banner, or database text.
      Trigger a failure and read the response.
- [ ] A dependency audit reports no known-vulnerable versions in the lockfile.
- [ ] Static analysis for the language runs in CI, and its findings are triaged.
- [ ] Every input has a documented maximum size, and exceeding it is rejected.
- [ ] Permission checks are enforced server-side per action, not by hiding UI.
- [ ] Tokens come from a CSPRNG; secret comparisons are constant-time.

Then test adversarially: submit oversized, malformed, wrongly-typed and
encoding-tricked input to each entry point. Correct behaviour is a clean
rejection with a generic message and a detailed internal log — not a crash, not
a partial write, not a revealing error.

## References

- Related core skills: `threat-modeling`, `client-server-trust`,
  `code-review-method`, `dependency-analysis`
- Platform applications: `web-security`, `web-authentication`, `roblox-security`
