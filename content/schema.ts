import { z } from "zod";

/**
 * Zod schema for content/profile.json (M1, zurielst.com rebuild).
 *
 * Two jobs:
 * 1. Shape: every section the site renders from, matched exactly and strict
 *    (unknown keys are rejected).
 * 2. Sanitization: a recursive walk over every string in the document that
 *    rejects Singapore phone number shapes, personal gmail addresses, the
 *    personal-gift subdomains, and em dashes (intent.md: no em dashes in
 *    site copy or docs).
 */

// ---------------------------------------------------------------------------
// Forbidden content patterns (checklist standing defaults 3 and 4; intent.md)
// ---------------------------------------------------------------------------

const SG_PHONE_PATTERN = /(\+?65[ -]?)?[89]\d{3}[ -]?\d{4}/;
const GMAIL_PATTERN = /@gmail\.com/i;
const FORBIDDEN_SUBSTRINGS = ["christine.zurielst", "janice.zurielst"] as const;
const EM_DASH_PATTERN = /\u2014/;

type PathSeg = string | number;

interface ForbiddenHit {
  path: PathSeg[];
  message: string;
}

function checkString(value: string, path: PathSeg[], hits: ForbiddenHit[]): void {
  if (SG_PHONE_PATTERN.test(value)) {
    hits.push({ path, message: "String matches a Singapore phone number shape; no phone number may appear anywhere." });
  }
  if (GMAIL_PATTERN.test(value)) {
    hits.push({ path, message: "String contains a gmail address; contact is zurielst@u.nus.edu only." });
  }
  const lower = value.toLowerCase();
  for (const sub of FORBIDDEN_SUBSTRINGS) {
    if (lower.includes(sub)) {
      hits.push({ path, message: `String references the excluded personal-gift subdomain "${sub}".` });
    }
  }
  if (EM_DASH_PATTERN.test(value)) {
    hits.push({ path, message: "String contains an em dash; use a comma, colon, or \" - \" instead." });
  }
}

/** Recursive walk over every string in the document, keys included. */
function findForbidden(value: unknown, path: PathSeg[], hits: ForbiddenHit[]): void {
  if (typeof value === "string") {
    checkString(value, path, hits);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbidden(item, [...path, index], hits));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      checkString(key, [...path, key], hits);
      findForbidden(child, [...path, key], hits);
    }
  }
}

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

const HttpUrl = z.string().url().startsWith("https://");
const MediaPath = z.string().regex(/^\/media\//, "Media references live under /media/");
const OgImagePath = z.literal("/og.png");

const LinkSchema = z
  .object({
    label: z.string().min(1),
    url: HttpUrl,
    note: z.string().min(1).optional(),
  })
  .strict();

const MediaRefSchema = z
  .object({
    type: z.enum(["image", "video"]),
    media: MediaPath,
    alt: z.string().min(1),
  })
  .strict();

// ---------------------------------------------------------------------------
// identity
// ---------------------------------------------------------------------------

const MetricSchema = z
  .object({
    value: z.string().min(1),
    label: z.string().min(1),
  })
  .strict();

const SocialSchema = z
  .object({
    platform: z.enum(["GitHub", "LinkedIn"]),
    url: HttpUrl,
  })
  .strict();

const IdentitySchema = z
  .object({
    name: z.literal("Zuriel Shanley Tanyory"),
    roles: z.array(z.string().min(1)).min(2),
    employer: z.string().min(1),
    tagline: z.string().min(1),
    bio_hook: z.string().min(1),
    metrics: z.array(MetricSchema).length(4),
    location: z
      .object({
        city: z.literal("Singapore"),
        timezone: z.literal("UTC+8"),
      })
      .strict(),
    email: z.literal("zurielst@u.nus.edu"),
    socials: z.array(SocialSchema).length(2),
    portrait: z
      .object({
        image: MediaPath,
        alt: z.string().min(1),
      })
      .strict(),
    github: z
      .object({
        username: z.literal("Leiruz"),
        url: HttpUrl,
        data_policy: z.string().min(1),
      })
      .strict(),
  })
  .strict();

// ---------------------------------------------------------------------------
// capabilities
// ---------------------------------------------------------------------------

const SkillSchema = z
  .object({
    name: z.string().min(1),
    since: z.string().min(1).optional(),
    detail: z.string().min(1).optional(),
  })
  .strict();

const CapabilityActSchema = z
  .object({
    id: z.string().min(1),
    act: z.number().int().min(1).max(3),
    title: z.string().min(1),
    narrative: z.string().min(1),
    skills: z.array(SkillSchema).min(1),
  })
  .strict();

const CapabilitiesSchema = z
  .object({
    acts: z.array(CapabilityActSchema).length(3),
  })
  .strict();

// ---------------------------------------------------------------------------
// work_cases
// ---------------------------------------------------------------------------

const WorkCaseSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    kicker: z.string().min(1),
    period: z.string().min(1),
    summary: z.string().min(1),
    stack: z.array(z.string().min(1)),
    links: z.array(LinkSchema),
    evidence: z.array(MediaRefSchema),
    note: z.string().min(1).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// timeline
// ---------------------------------------------------------------------------

const TimelineEntrySchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["role", "education", "cca"]),
    org: z.string().min(1),
    title: z.string().min(1),
    period: z.string().min(1),
    summary: z.string().min(1),
  })
  .strict();

// ---------------------------------------------------------------------------
// proof_wall
// ---------------------------------------------------------------------------

const CertificationSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    issuer: z.string().min(1),
    year: z.string().min(1).optional(),
    validity: z.string().min(1).optional(),
    image: MediaPath.optional(),
    credential: MediaPath.optional(),
    caption: z.string().min(1).optional(),
  })
  .strict();

const AwardSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    issuer: z.string().min(1),
    year: z.string().min(1),
    image: MediaPath.optional(),
    caption: z.string().min(1).optional(),
  })
  .strict();

const CtfResultSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    organizer: z.string().min(1),
    year: z.string().min(1),
    result: z.string().min(1),
    image: MediaPath.optional(),
    caption: z.string().min(1).optional(),
  })
  .strict();

const PublicationSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    year: z.string().min(1),
    link: HttpUrl,
    format: z.string().min(1),
  })
  .strict();

const ProofExtraSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: z.enum(["image", "video"]),
    media: MediaPath,
    caption: z.string().min(1).optional(),
  })
  .strict();

const ProofWallSchema = z
  .object({
    certifications: z.array(CertificationSchema).min(1),
    awards: z.array(AwardSchema).min(1),
    ctf_results: z.array(CtfResultSchema).min(1),
    publications: z.array(PublicationSchema).length(2),
    extras: z.array(ProofExtraSchema),
  })
  .strict();

// ---------------------------------------------------------------------------
// products
// ---------------------------------------------------------------------------

const ProductSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    period: z.string().min(1).optional(),
    origin_story: z.boolean().optional(),
    summary: z.string().min(1),
    stack: z.array(z.string().min(1)),
    links: z.array(LinkSchema),
    media: z.array(MediaRefSchema).optional(),
    note: z.string().min(1).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// faq, chat, easter_eggs, meta
// ---------------------------------------------------------------------------

const FaqEntrySchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    answer: z.string().min(1),
  })
  .strict();

const ChatSchema = z
  .object({
    intent_chips: z.array(z.string().min(1)).min(3).max(6),
    disclaimer: z.string().min(1),
  })
  .strict();

const EasterEggsSchema = z
  .object({
    terminal: z
      .object({
        commands: z.array(z.string().min(1)).min(1),
        source: z.string().min(1),
        note: z.string().min(1),
      })
      .strict(),
    towerblock: z
      .object({
        label: z.string().min(1),
        url: HttpUrl,
        repo: HttpUrl,
        trigger: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const MetaSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    og: z
      .object({
        title: z.string().min(1),
        description: z.string().min(1),
        image: OgImagePath,
        url: HttpUrl,
        type: z.literal("profile"),
      })
      .strict(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Stack brands (vendors and products worked with; nominative use only)
// ---------------------------------------------------------------------------

const StackBrandSchema = z
  .object({
    name: z.string().min(1).max(40),
    context: z.string().min(1).max(120),
  })
  .strict();

const StackBrandsSchema = z
  .object({
    disclaimer: z.string().min(20).max(240),
    brands: z.array(StackBrandSchema).min(4).max(16),
  })
  .strict();

// ---------------------------------------------------------------------------
// Root schema
// ---------------------------------------------------------------------------

const IntroSchema = z
  .object({
    bullets: z.array(z.string().min(20).max(240)).min(2).max(4),
  })
  .strict();

const StackCategorySchema = z
  .object({
    name: z.string().min(2).max(40),
    items: z.array(z.string().min(1).max(40)).min(2).max(12),
  })
  .strict();

const StackSchema = z
  .object({
    categories: z.array(StackCategorySchema).min(3).max(8),
  })
  .strict();

const ProfileObjectSchema = z
  .object({
    identity: IdentitySchema,
    intro: IntroSchema,
    capabilities: CapabilitiesSchema,
    stack: StackSchema,
    work_cases: z.array(WorkCaseSchema).min(3).max(4),
    timeline: z.array(TimelineEntrySchema).min(1),
    proof_wall: ProofWallSchema,
    products: z.array(ProductSchema).min(1),
    faq: z.array(FaqEntrySchema).min(1),
    chat: ChatSchema,
    easter_eggs: EasterEggsSchema,
    stack_brands: StackBrandsSchema,
    meta: MetaSchema,
  })
  .strict();

export const ProfileSchema = ProfileObjectSchema.superRefine((profile, ctx) => {
  const hits: ForbiddenHit[] = [];
  findForbidden(profile, [], hits);
  for (const hit of hits) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: hit.path,
      message: hit.message,
    });
  }
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Profile = z.infer<typeof ProfileSchema>;
export type Identity = z.infer<typeof IdentitySchema>;
export type Metric = z.infer<typeof MetricSchema>;
export type Social = z.infer<typeof SocialSchema>;
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
export type CapabilityAct = z.infer<typeof CapabilityActSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type WorkCase = z.infer<typeof WorkCaseSchema>;
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;
export type ProofWall = z.infer<typeof ProofWallSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Award = z.infer<typeof AwardSchema>;
export type CtfResult = z.infer<typeof CtfResultSchema>;
export type Publication = z.infer<typeof PublicationSchema>;
export type ProofExtra = z.infer<typeof ProofExtraSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type FaqEntry = z.infer<typeof FaqEntrySchema>;
export type Chat = z.infer<typeof ChatSchema>;
export type EasterEggs = z.infer<typeof EasterEggsSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type Link = z.infer<typeof LinkSchema>;
export type MediaRef = z.infer<typeof MediaRefSchema>;
