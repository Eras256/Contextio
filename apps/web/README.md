# @contextio/web

Next.js (App Router) frontend for Contextio. Institutional dark theme, Tailwind,
server components by default with small client islands for navigation.

## Sections (top navbar)

1. **Overview** — hero, product explainer cards, SVG architecture diagram.
2. **Treasury** — balances, liquidity/yield allocation, positions, risk config, history.
3. **Payroll** — employees (BR/AR/CO), schedule editor, funding simulation.
4. **Agent & Legal** — LCP editor, consent records, agent decision log with LCP hashes.
5. **Integrations** — DeFindex vaults, Blend positions, Stellar status, platform health.
6. **Security** — non-custodial design, risk disclosures, scans, RBAC matrix.
7. **Docs & SCF** — building blocks, SCF Integration Track mapping, judge links.

## Data

The UI ships with demo data (`src/lib/demoData.ts`) so it runs **standalone** with
no backend. Set `NEXT_PUBLIC_API_URL` and use the typed client in `src/lib/api.ts`
to switch any view to live data from `apps/api`.

## Commands

```bash
pnpm --filter @contextio/web dev        # http://localhost:3000
pnpm --filter @contextio/web build
pnpm --filter @contextio/web test:e2e   # Playwright (starts dev server)
```

## Notes

- `/.well-known/contextio-legal-context.json` links point at the API in a connected
  deployment; in production each tenant maps this path on their own domain.
- Accessibility: semantic landmarks, focus rings, color-contrast-aware palette,
  responsive nav with a mobile section scroller.
