import { z } from "zod";

// ── Shared enum values ────────────────────────────────────────────────────────

const CLAIM_TYPES = [
  "PROPERTY_DAMAGE",
  "MEDICAL",
  "VEHICLE",
  "THEFT",
  "LIABILITY",
  "TRAVEL",
] as const;

const CLAIM_SOURCES = ["EMAIL", "FORM", "PDF"] as const;

const CLAIM_STATUSES = [
  "SUBMITTED",
  "EXTRACTING",
  "VALIDATING",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "ESCALATED",
] as const;

const CLAIM_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

// ── Schemas ───────────────────────────────────────────────────────────────────

export const CreateClaimSchema = z.object({
  policyNumber: z.string().min(6, "Policy number must be at least 6 characters"),
  claimantName: z.string().min(1, "Claimant name is required"),
  claimantEmail: z.string().email("Invalid email address"),
  claimType: z.enum(CLAIM_TYPES),
  incidentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Incident date must be in YYYY-MM-DD format"),
  claimAmount: z.number().positive("Claim amount must be positive"),
  currency: z.string().default("USD"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  source: z.enum(CLAIM_SOURCES),
});

export const UpdateClaimSchema = CreateClaimSchema.partial().extend({
  reviewNotes: z.string().optional(),
  status: z.enum(CLAIM_STATUSES).optional(),
  priority: z.enum(CLAIM_PRIORITIES).optional(),
});

export const ClaimFilterSchema = z.object({
  status: z.enum(CLAIM_STATUSES).optional(),
  priority: z.enum(CLAIM_PRIORITIES).optional(),
  source: z.enum(CLAIM_SOURCES).optional(),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type CreateClaimInput = z.infer<typeof CreateClaimSchema>;
export type UpdateClaimInput = z.infer<typeof UpdateClaimSchema>;
export type ClaimFilterInput = z.infer<typeof ClaimFilterSchema>;
