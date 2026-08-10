# AI assistance in this repository

Contextio is built with AI assistance, primarily Claude Code. This is
disclosed because it's a fact about how the code was produced, and because
much of the Stellar ecosystem's own tooling and documentation is openly
AI-assisted too.

## How the work is divided

Models draft, refactor, and document. Every architectural decision, every
security invariant, and every factual claim about the product's live state
is meant to be checked against the running deployment — not asserted from
memory — before it lands. That checking is visible in the commit history,
not just claimed here: corrections to a wrong mainnet tenant ID, to an
"invitation-only" claim that turned out to have a real gap
(`AUTH_DEMO_TENANT_ID` auto-enrolling any wallet before it was fixed), and to
building-block categories in `TECHNICAL.md`/`docs/SCF-INTEGRATION.md` that
conflated the base platform with chosen Integration List items, all came from
comparing generated text against the actual deployed system and finding it
wrong.

## What doesn't get asserted without a human confirming it directly

- Claims about real people's credentials, professional status, or
  affiliations. A model can't verify whether someone currently holds a title
  — that's checked with the person or the team, not inferred, and this repo's
  own history has an example: an "Ambassador" credit was removed from the
  Team section, and a credential attributed to one project was corrected to
  the project that actually earned it, both only after direct confirmation
  from the team.
- Any specific numeric score or rating presented as if a third party issued
  it, unless the actual issuer is named. A self-assessment doesn't get
  written up as an audit result.
- Legal conclusions. Regulatory analysis in this repo (LFPIORPI, MiCA, FinCEN)
  is read from primary sources — actual statute text, actual regulator
  publications — not summarized from a model's training data, and is
  explicitly flagged as pending real counsel review, not treated as legal
  advice.

## What's mechanically enforced, not just reviewed

The non-custodial invariants aren't a claim resting on review alone —
`assertMainnetHasNoHotKey` (`packages/config/src/env.ts`) is covered by an
automated test (`apps/api/test/envGuard.test.ts`) that fails if a mainnet
process would boot with a signer secret present, and the real deployed
secrets have been checked directly against `fly secrets list`, not assumed
correct from the code alone.

## Trailers

Commits produced with AI assistance in this repository carry a
`Co-Authored-By: Claude` trailer going forward, starting 2026-08-07. Earlier
commits in this repository's history don't have one — not because the work
was human-only before that date, but because the project didn't disclose it
in commit metadata yet. History is not rewritten to add it retroactively:
doing so would change every commit hash after the edit, including the ones
this repository's own documentation cites as evidence (transaction examples,
LCP document versions tied to specific commits) — rewriting history to add a
disclosure would break the exact kind of verifiability this project is built
around.
