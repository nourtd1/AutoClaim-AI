// ── Enumerations ──────────────────────────────────────────────────────────────

export type ActorType = "AGENT" | "ROBOT" | "HUMAN";

export type ClaimStatus =
  | "SUBMITTED"
  | "EXTRACTING"
  | "VALIDATING"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ESCALATED";

export type ClaimPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ClaimSource = "EMAIL" | "FORM" | "PDF";

export type DocumentStatus = "MISSING" | "PRESENT" | "INVALID";

export type ClaimStage =
  | "INTAKE"
  | "EXTRACTION"
  | "VALIDATION"
  | "EXCEPTION_ROUTING"
  | "HUMAN_REVIEW"
  | "RESOLUTION";

// ── Sub-interfaces ────────────────────────────────────────────────────────────

export interface ClaimDocument {
  id: string;
  name: string;
  type: string;
  status: DocumentStatus;
  url: string | null;
  uploadedAt: string;
}

export interface ExtractedData {
  /** 0–1 confidence score from the extraction agent */
  confidence: number;
  policyNumber: string | null;
  claimantName: string | null;
  incidentDate: string | null;
  claimAmount: number | null;
  claimType: string | null;
  documentList: string[];
  rawText: string;
  missingFields: string[];
}

export interface ValidationResult {
  isValid: boolean;
  policyExists: boolean;
  documentsComplete: boolean;
  amountWithinLimit: boolean;
  errors: string[];
  warnings: string[];
  /** 0–100 risk score computed by the validation agent */
  riskScore: number;
}

// ── Core Claim interface ──────────────────────────────────────────────────────

export interface Claim {
  id: string;
  policyNumber: string;
  claimantName: string;
  claimantEmail: string;
  claimType: string;
  /** ISO 8601 date string */
  incidentDate: string;
  claimAmount: number;
  currency: string;
  description: string;
  status: ClaimStatus;
  priority: ClaimPriority;
  stage: ClaimStage;
  source: ClaimSource;
  documents: ClaimDocument[];
  extractedData: ExtractedData | null;
  validationResult: ValidationResult | null;
  reviewNotes: string | null;
  assignedTo: string | null;
  /** ISO 8601 datetime string */
  createdAt: string;
  /** ISO 8601 datetime string */
  updatedAt: string;
  /** ISO 8601 datetime string, null until resolved */
  resolvedAt: string | null;
}

// ── Audit / timeline event ────────────────────────────────────────────────────

export interface StageEvent {
  id: string;
  claimId: string;
  stage: ClaimStage;
  status: ClaimStatus;
  actor: "AGENT" | "ROBOT" | "HUMAN";
  notes: string | null;
  /** ISO 8601 datetime string */
  timestamp: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: string;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ── Paginated list helper ─────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Reviewer ──────────────────────────────────────────────────────────────────

export interface Reviewer {
  id: string;
  name: string;
  email: string;
  role: string;
  isAvailable: boolean;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total: number;
  approved: number;
  rejected: number;
  escalated: number;
  pending: number;
  avgProcessingTime: number;
  autoApprovalRate: number;
}

// ── Live Feed event (subset of StageEvent with claimantName joined) ───────────

export interface FeedEvent {
  id: string;
  claimId: string;
  stage: ClaimStage;
  status: ClaimStatus;
  actor: ActorType;
  notes: string | null;
  timestamp: string;
  claimantName: string;
}

// ── Document attachment (maps to `documents` table) ───────────────────────────

export interface DocumentAttachment {
  id: string;
  claimId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  uploadedAt: string;
}

// ── Form / input types ────────────────────────────────────────────────────────

export interface NewClaimInput {
  policyNumber: string;
  claimantName: string;
  claimantEmail: string;
  claimType: string;
  incidentDate: string;
  claimAmount: number;
  currency: string;
  description: string;
  source: ClaimSource;
}
