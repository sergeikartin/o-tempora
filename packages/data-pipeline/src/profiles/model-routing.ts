import {
  type Complete,
  createCompleter,
  isProvider,
  PROVIDERS,
  type Provider,
} from './providers.js';
import { createResearcher, type Research } from './verification/researcher.js';

const DEFAULT_MODEL: Record<Provider, string> = {
  openai: 'gpt-6-astra',
  anthropic: 'claude-opus-5-5',
  gemini: 'gemini-4-argon',
};

export function flagValue(
  argv: readonly string[],
  name: string,
): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

// A skipped item needs no provider credentials. Reuse the client once needed.
function lazyCompleter(provider: Provider, model: string): Complete {
  let complete: Complete | undefined;
  return (prompt, role) => {
    complete ??= createCompleter(provider, model);
    return complete(prompt, role);
  };
}

interface CompletionRoute {
  provider: Provider;
  label: string;
  complete: Complete;
}

export function routeProfileModels(
  command: 'write' | 'audit' | 'translate',
  argv: readonly string[],
): CompletionRoute {
  const provider = flagValue(argv, 'provider') ?? 'openai';
  if (!isProvider(provider)) {
    throw new Error(
      command === 'translate'
        ? `Unknown provider: ${provider}`
        : `--provider must be one of ${PROVIDERS.join(', ')}`,
    );
  }
  const model = flagValue(argv, 'model') ?? DEFAULT_MODEL[provider];
  const label = `${provider}/${model}`;
  if (command === 'write') {
    let complete: Complete | undefined;
    return {
      provider,
      label,
      get complete() {
        // Check credentials when there is work, before staging any item.
        complete ??= createCompleter(provider, model);
        return complete;
      },
    };
  }
  const complete = lazyCompleter(provider, model);
  if (command === 'audit') return { provider, label, complete };

  const audit = lazyCompleter(
    provider,
    flagValue(argv, 'audit-model') ?? model,
  );
  return {
    provider,
    label,
    complete: (prompt, role) =>
      (role === 'translation-audit' ? audit : complete)(prompt, role),
  };
}

export function routeVerificationModels(argv: readonly string[]): {
  research: Research;
  complete: Complete;
} {
  const model = flagValue(argv, 'model') ?? DEFAULT_MODEL.openai;
  const auditProvider = flagValue(argv, 'audit-provider') ?? 'openai';
  if (!isProvider(auditProvider))
    throw new Error(`--audit-provider must be one of ${PROVIDERS.join(', ')}`);
  const auditModel =
    flagValue(argv, 'audit-model') ??
    (auditProvider === 'openai' ? model : DEFAULT_MODEL[auditProvider]);
  const openAiModel = auditProvider === 'openai' ? auditModel : model;
  const complete = lazyCompleter('openai', openAiModel);
  const audit =
    auditProvider === 'openai'
      ? complete
      : lazyCompleter(auditProvider, auditModel);
  const translate = lazyCompleter(
    'openai',
    flagValue(argv, 'translation-model') ?? openAiModel,
  );
  let research: Research | undefined;
  return {
    research: (...args) => {
      research ??= createResearcher(model);
      return research(...args);
    },
    complete: (prompt, role) => {
      if (role === 'audit') return audit(prompt, role);
      if (role === 'translate') return translate(prompt, role);
      return complete(prompt, role);
    },
  };
}
