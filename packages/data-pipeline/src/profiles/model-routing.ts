import path from 'node:path';
import {
  type Complete,
  createCompleter,
  isProvider,
  PROVIDERS,
  type Provider,
} from './providers.js';
import { SessionBridge } from './session.js';
import { createResearcher, type Research } from './verification/researcher.js';

const DEFAULT_MODEL: Record<Provider, string> = {
  openai: 'gpt-6-astra',
  anthropic: 'claude-opus-5-5',
  gemini: 'gemini-4-argon',
};

const PROVIDER_MODEL_FLAGS = [
  'model',
  'audit-model',
  'audit-provider',
  'translation-model',
  'provider',
];

export function flagValue(
  argv: readonly string[],
  name: string,
): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function sessionFromFlags(argv: readonly string[]): SessionBridge | undefined {
  const execution = flagValue(argv, 'execution') ?? 'api';
  if (execution !== 'api' && execution !== 'session') {
    throw new Error('--execution must be api or session');
  }
  const directory = flagValue(argv, 'session-dir');
  if (execution === 'api') {
    if (directory !== undefined)
      throw new Error('--session-dir requires --execution=session');
    return undefined;
  }
  if (!directory || !path.isAbsolute(directory))
    throw new Error(
      '--execution=session requires --session-dir=<absolute directory>',
    );
  if (
    PROVIDER_MODEL_FLAGS.some((name) => flagValue(argv, name) !== undefined)
  ) {
    throw new Error(
      'Session agents are selected by the conversation; omit provider/model flags',
    );
  }
  return new SessionBridge({ directory, log: console.log });
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
  provider: Provider | 'session';
  label: string;
  complete: Complete;
}

export function routeProfileModels(
  command: 'write' | 'audit' | 'translate',
  argv: readonly string[],
): CompletionRoute {
  const session = command === 'audit' ? undefined : sessionFromFlags(argv);
  if (session) {
    return {
      provider: 'session',
      label: 'session agents',
      complete: session.complete,
    };
  }

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
  const session = sessionFromFlags(argv);
  if (session) return session;

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
