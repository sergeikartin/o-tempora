import { cpSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

const PROFILES_DIR = resolve(
  import.meta.dirname,
  '../../shared-types/src/data/profiles',
);

// The panel fetches shipped Profiles at runtime (`profiles/<locale>/<slug>.json`)
// rather than bundling them, so the folder is served in dev and copied verbatim
// into `dist` on build.
export function profilesStaticPlugin(): Plugin {
  let outDir = '';
  return {
    name: 'o-tempora:profiles-static',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const { pathname } = new URL(req.url ?? '/', 'http://localhost');
        if (!/^\/profiles\/[a-z]+\/[^/]+\.json$/.test(pathname)) return next();
        const file = resolve(PROFILES_DIR, pathname.slice('/profiles/'.length));
        if (!existsSync(file)) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(readFileSync(file));
      });
    },
    writeBundle() {
      if (!existsSync(PROFILES_DIR)) return;
      cpSync(PROFILES_DIR, resolve(outDir, 'profiles'), { recursive: true });
    },
  };
}
