/// <reference types="vite/client" />

interface ImportMetaEnv {
  // GlitchTip DSN for client-side error capture (docs/config-variables.md) —
  // absent in local dev and in any build where the secret isn't set, which
  // leaves monitoring a no-op rather than failing the build.
  readonly VITE_GLITCHTIP_DSN?: string;
}
