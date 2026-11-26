import { createHash } from 'node:crypto';
import { z } from 'zod';

export const ProfileLocaleSchema = z.enum(['en', 'ru']);
export type ProfileLocale = z.infer<typeof ProfileLocaleSchema>;

export const QidSchema = z
  .string()
  .regex(/^Q[1-9]\d*$/, 'Expected a Wikidata QID such as Q937');

export function isSafePublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.hostname.length > 0 &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export const PublicUrlSchema = z
  .string()
  .min(1)
  .refine(isSafePublicHttpUrl, 'Expected a public http(s) URL');

export const KeyMomentSchema = z.strictObject({
  date: z.string().trim().min(1),
  title: z.string().trim().min(1),
  text: z.string().trim().min(1),
  sourceUrl: PublicUrlSchema.optional(),
});
export type KeyMoment = z.infer<typeof KeyMomentSchema>;

export const DeepFactSchema = z.strictObject({
  text: z.string().trim().min(1),
  isLegend: z.boolean(),
  sourceUrl: PublicUrlSchema.optional(),
});
export type DeepFact = z.infer<typeof DeepFactSchema>;

export const ConnectionSchema = z.strictObject({
  qid: QidSchema,
  reason: z.string().trim().min(1),
});
export type RawConnection = z.infer<typeof ConnectionSchema>;

export const ProfileContentSchema = z.strictObject({
  overview: z.string().trim().min(1),
  keyMoments: z.array(KeyMomentSchema).min(1).max(4),
  deepFacts: z.array(DeepFactSchema).max(3),
  connections: z.array(ConnectionSchema),
});
export type ProfileContent = z.infer<typeof ProfileContentSchema>;

// Shared draft schema for both English and Russian `.work/<QID>/<locale>.draft.json`.
export const ProfileDraftSchema = ProfileContentSchema.extend({
  qid: QidSchema,
  subjectDates: z.string().trim().min(1),
  sourceHash: z.string().trim().min(1).optional(),
  writerModel: z.string().trim().min(1).optional(),
});
export type ProfileDraft = z.infer<typeof ProfileDraftSchema>;

const NumericIndexKey = z
  .string()
  .regex(/^\d+$/, 'Expected a non-negative array index');

// Shared field-only patch schema for the 1-round revision loop.
export const ProfilePatchSchema = z
  .strictObject({
    overview: z.string().trim().min(1).optional(),
    keyMoments: z
      .record(NumericIndexKey, KeyMomentSchema.nullable())
      .optional(),
    deepFacts: z.record(NumericIndexKey, DeepFactSchema.nullable()).optional(),
    connections: z
      .record(NumericIndexKey, ConnectionSchema.nullable())
      .optional(),
  })
  .refine(
    (patch) =>
      patch.overview !== undefined ||
      (patch.keyMoments !== undefined &&
        Object.keys(patch.keyMoments).length > 0) ||
      (patch.deepFacts !== undefined &&
        Object.keys(patch.deepFacts).length > 0) ||
      (patch.connections !== undefined &&
        Object.keys(patch.connections).length > 0),
    'Patch must modify or drop at least one field',
  );
export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;

export const CheckItemSchema = z.strictObject({
  path: z.string().trim().min(1),
  status: z.enum(['pass', 'blocker']),
  note: z.string().trim().min(1),
});

export const CheckBlockerSchema = z.strictObject({
  path: z.string().trim().min(1),
  issue: z.string().trim().min(1),
  fix: z.string().trim().min(1),
});

// Shared checker verdict schema for English and Russian check / recheck replies.
export const CheckVerdictSchema = z
  .strictObject({
    qid: QidSchema,
    locale: ProfileLocaleSchema,
    verdict: z.enum(['pass', 'revise', 'escalate']),
    checkerModel: z.string().trim().min(1).optional(),
    checks: z.array(CheckItemSchema).min(1),
    blockers: z.array(CheckBlockerSchema),
    suggestions: z.array(z.string().trim().min(1)).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.verdict === 'pass' && value.blockers.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['blockers'],
        message: 'A passing verdict cannot contain blockers',
      });
    }
    if (value.verdict === 'revise' && value.blockers.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['blockers'],
        message: 'A revise verdict must include at least one blocker',
      });
    }
  });
export type CheckVerdict = z.infer<typeof CheckVerdictSchema>;

export const ProfileMetaSchema = z.strictObject({
  qid: QidSchema,
  locale: ProfileLocaleSchema,
  subjectDates: z.string().trim().min(1),
  approvedAt: z.string().trim().min(1),
  sourceHash: z.string().trim().min(1).optional(),
  writerModel: z.string().trim().min(1).optional(),
  checkerModel: z.string().trim().min(1).optional(),
});
export type ProfileMeta = z.infer<typeof ProfileMetaSchema>;

// Shared committed Profile schema stored under `data/raw/profiles/<lane>/`.
export const StoredProfileSchema = ProfileContentSchema.extend({
  meta: ProfileMetaSchema,
}).superRefine((value, ctx) => {
  if (value.meta.locale === 'ru' && !value.meta.sourceHash) {
    ctx.addIssue({
      code: 'custom',
      path: ['meta', 'sourceHash'],
      message: 'Russian Profiles must record meta.sourceHash',
    });
  }
});
export type StoredProfile = z.infer<typeof StoredProfileSchema>;

// Hashes the English prose and structural fields that Russian translation depends on.
// Updating only a citation URL does not invalidate translated prose.
export function computeEnglishSourceHash(content: ProfileContent): string {
  const canonical = {
    overview: content.overview,
    keyMoments: content.keyMoments.map(({ date, title, text }) => ({
      date,
      title,
      text,
    })),
    deepFacts: content.deepFacts.map(({ text, isLegend }) => ({
      text,
      isLegend,
    })),
    connections: content.connections.map(({ qid, reason }) => ({
      qid,
      reason,
    })),
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex')
    .slice(0, 16);
}

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${where}${issue.message}`;
  });
}
