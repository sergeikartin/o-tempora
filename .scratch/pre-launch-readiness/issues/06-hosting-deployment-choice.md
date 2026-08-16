Type: grilling
Status: open

# Hosting & deployment choice

## Question

`docs/deployment.md` deliberately doesn't prescribe a host — "upload both directories as-is to any static host" — and no CI/deploy config exists in the repo (`.github/workflows` is absent). Sergei explicitly deferred this decision during chart-the-map grilling rather than picking from Cloudflare Pages / Vercel / Netlify / GitHub Pages on the spot.

Resolve when ready:
- Which static host (Cloudflare Pages, Vercel, Netlify, GitHub Pages, or other).
- Whether a custom domain is already owned, or needs to be acquired.
- How the bare-domain root behaves — `docs/deployment.md` notes it currently "has no required behavior yet; redirecting it to `/en/` as the default landing view is a reasonable choice but not implemented."
- Whether a CI deploy pipeline gets set up, or deploys stay manual.
- This unblocks [SEO, social preview & meta basics](09-seo-meta-social-basics.md), which needs the real domain for canonical URLs / `sitemap.xml` / `hreflang`.
