Type: grilling
Status: resolved

# Hosting & deployment choice

## Question

`docs/deployment.md` deliberately doesn't prescribe a host — "upload both directories as-is to any static host" — and no CI/deploy config exists in the repo (`.github/workflows` is absent). Sergei explicitly deferred this decision during chart-the-map grilling rather than picking from Cloudflare Pages / Vercel / Netlify / GitHub Pages on the spot.

Resolve when ready:
- Which static host (Cloudflare Pages, Vercel, Netlify, GitHub Pages, or other).
- Whether a custom domain is already owned, or needs to be acquired.
- How the bare-domain root behaves — `docs/deployment.md` notes it currently "has no required behavior yet; redirecting it to `/en/` as the default landing view is a reasonable choice but not implemented."
- Whether a CI deploy pipeline gets set up, or deploys stay manual.
- This unblocks [SEO, social preview & meta basics](09-seo-meta-social-basics.md), which needs the real domain for canonical URLs / `sitemap.xml` / `hreflang`.

## Answer

Already resolved and shipped ahead of this ticket being marked — commit `25085c3` ("Deploy to GitHub Pages with English served from the domain root"): GitHub Pages, custom domain `otempora.info`, `.github/workflows/deploy.yml` builds and deploys automatically on every push to `main` (or manual `workflow_dispatch`), writing a `CNAME` file so the custom domain survives each deploy. English is served from the domain root, no `/en/` redirect (`docs/adr/0003-english-served-from-domain-root.md`). Bare-root behavior: same as English root, no separate redirect needed since English *is* the root. This ticket's tracker status was just stale; `docs/deployment.md` has the full one-time DNS/registrar setup notes.
