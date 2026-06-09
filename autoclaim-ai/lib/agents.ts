import Anthropic from "@anthropic-ai/sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import {
  getDb,
  getClaimById,
  updateClaimExtraction,
  updateClaimValidation,
  updateClaimStatus,
  addStageEvent,
  assignReviewer,
  getAvailableReviewers,
} from "./db";
import type {
  ExtractedData,
  ValidationResult,
  ClaimStatus,
  ClaimStage,
  Reviewer,
} from "./types";

// ── Client selection: Bedrock (AWS) or direct Anthropic API ──────────────────
// Set CLAUDE_CODE_USE_BEDROCK=1 in .env.local to use AWS Bedrock.
// Otherwise set ANTHROPIC_API_KEY for the direct Anthropic API.

const USE_BEDROCK = process.env.CLAUDE_CODE_USE_BEDROCK === "1";

// Bedrock cross-region inference profile — same model as Claude Code itself
const BEDROCK_MODEL = "us.anthropic.claude-sonnet-4-6";

// Direct API model (kept for future use when switching back)
const DIRECT_MODEL = "claude-sonnet-4-5-20251022";

type ClientMessages = {
  create: (params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: { role: "user"; content: string }[];
  }) => Promise<{ content: Array<{ type: string; text?: string }> }>;
};

function getClient(): { messages: ClientMessages; model: string } {
  if (USE_BEDROCK) {
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region    = process.env.AWS_REGION ?? "us-east-1";
    // If both keys are present, pass them explicitly (BothStaticCreds overload).
    // Otherwise let the SDK use the AWS credential provider chain (NoStaticCreds overload).
    const client = accessKey && secretKey
      ? new AnthropicBedrock({ awsAccessKey: accessKey, awsSecretKey: secretKey, awsRegion: region })
      : new AnthropicBedrock({ awsRegion: region });
    return { messages: client.messages as unknown as ClientMessages, model: BEDROCK_MODEL };
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return { messages: client.messages as unknown as ClientMessages, model: DIRECT_MODEL };
}

const { messages: anthropicMessages, model: MODEL } = getClient();

// ── Extraction agent ──────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `Tu es un agent d'extraction pour un système de gestion de sinistres d'assurance.
Analyse le texte soumis et extrais les informations structurées du sinistre.
Réponds UNIQUEMENT en JSON valide sans aucun texte avant ou après.
Le JSON doit respecter exactement ce schema :
{
  "confidence": number entre 0 et 1,
  "policyNumber": string ou null,
  "claimantName": string ou null,
  "incidentDate": string ISO ou null,
  "claimAmount": number ou null,
  "claimType": "ACCIDENT" | "THEFT" | "MEDICAL" | "PROPERTY_DAMAGE" | "LIABILITY" | null,
  "documentList": string[],
  "rawText": string,
  "missingFields": string[]
}`;

export async function extractClaimData(claimId: string): Promise<ExtractedData> {
  const claim = getClaimById(claimId);
  if (!claim) throw new Error(`Claim not found: ${claimId}`);

  updateClaimStatus(claimId, "EXTRACTING", "EXTRACTION");

  const sourceText = [
    claim.description,
    claim.claimantName ? `Déclarant: ${claim.claimantName}` : null,
    claim.policyNumber ? `Numéro de police: ${claim.policyNumber}` : null,
    claim.claimType ? `Type: ${claim.claimType}` : null,
    claim.incidentDate ? `Date de l'incident: ${claim.incidentDate}` : null,
    claim.claimAmount ? `Montant réclamé: ${claim.claimAmount} ${claim.currency}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const message = await anthropicMessages.create({
    model: MODEL,
    max_tokens: 1024,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: sourceText }],
  });

  const rawContent = message.content[0];
  if (!rawContent || rawContent.type !== "text" || !rawContent.text) {
    throw new Error("Unexpected response type from Claude API");
  }

  // Strip markdown code fences if the model wraps its response (e.g. ```json ... ```)
  const rawText = rawContent.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  let extracted: ExtractedData;
  try {
    extracted = JSON.parse(rawText) as ExtractedData;
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${rawText}`);
  }

  if (extracted.confidence < 0.6) {
    if (!extracted.missingFields.includes("confidence_low")) {
      extracted.missingFields.push("confidence_low");
    }
  }

  updateClaimExtraction(claimId, extracted);

  addStageEvent({
    claimId,
    stage: "EXTRACTION",
    status: "VALIDATING",
    actor: "AGENT",
    notes: `Extracted by Claude AI, confidence: ${extracted.confidence.toFixed(2)}`,
  });

  updateClaimStatus(claimId, "VALIDATING", "VALIDATION");

  return extracted;
}

// ── Validation agent ──────────────────────────────────────────────────────────

const REQUIRED_DOCS: Record<string, string[]> = {
  ACCIDENT: ["police_report", "photos", "medical_certificate"],
  THEFT: ["police_report", "inventory_list"],
  MEDICAL: ["medical_certificate", "receipts"],
  PROPERTY_DAMAGE: ["photos", "repair_estimate"],
  LIABILITY: ["incident_report", "witness_statements"],
};

const AMOUNT_LIMIT_USD = 50_000;

function checkDocumentsComplete(claimType: string, documentList: string[]): boolean {
  const required = REQUIRED_DOCS[claimType.toUpperCase()] ?? [];
  if (required.length === 0) return true;
  return required.every((req) =>
    documentList.some((doc) => doc.toLowerCase().includes(req.toLowerCase()))
  );
}

function computeRiskScore(params: {
  claimAmount: number;
  documentsComplete: boolean;
  confidence: number;
  claimType: string | null;
  incidentDate: string | null;
}): number {
  let score = 0;

  if (params.claimAmount > 25_000) score += 30;
  if (!params.documentsComplete) score += 20;
  if (params.confidence < 0.7) score += 25;
  if (params.claimType?.toUpperCase() === "LIABILITY") score += 15;

  if (params.incidentDate) {
    const daysElapsed =
      (Date.now() - new Date(params.incidentDate).getTime()) / 86_400_000;
    if (daysElapsed > 365) score += 10;
  }

  return Math.min(score, 100);
}

function getLeastLoadedReviewer(): Reviewer | null {
  const reviewers = getAvailableReviewers();
  if (!reviewers.length) return null;

  const db = getDb();
  const withLoad = reviewers.map((r) => {
    const row = db
      .prepare(
        `SELECT COUNT(*) as cnt FROM claims
         WHERE assignedTo = ? AND status NOT IN ('APPROVED','REJECTED') AND deletedAt IS NULL`
      )
      .get(r.id) as { cnt: number };
    return { reviewer: r, load: row.cnt };
  });

  withLoad.sort((a, b) => a.load - b.load);
  return withLoad[0]?.reviewer ?? null;
}

function routeCase(claimId: string, result: ValidationResult): void {
  let newStatus: ClaimStatus;
  let newStage: ClaimStage;
  const reasons: string[] = [];
  let needsReviewer = false;

  // Priority order: hard escalations first, then normal routing
  if (!result.amountWithinLimit) {
    newStatus = "ESCALATED";
    newStage = "HUMAN_REVIEW";
    reasons.push("Amount exceeds hard limit");
    needsReviewer = true;
  } else if (result.riskScore >= 70) {
    newStatus = "ESCALATED";
    newStage = "HUMAN_REVIEW";
    reasons.push(`Risk score too high: ${result.riskScore}`);
    needsReviewer = true;
  } else if (!result.isValid && result.errors.length > 0) {
    newStatus = "PENDING_REVIEW";
    newStage = "EXCEPTION_ROUTING";
    reasons.push(...result.errors);
    needsReviewer = true;
  } else if (result.isValid && result.riskScore >= 40) {
    // riskScore is 40–69 here (>=70 caught above)
    newStatus = "PENDING_REVIEW";
    newStage = "HUMAN_REVIEW";
    reasons.push(`Moderate risk score: ${result.riskScore}`);
    needsReviewer = true;
  } else {
    // isValid=true, riskScore<40
    newStatus = "APPROVED";
    newStage = "RESOLUTION";
  }

  updateClaimStatus(claimId, newStatus, newStage);

  if (needsReviewer) {
    const reviewer = getLeastLoadedReviewer();
    if (reviewer) assignReviewer(claimId, reviewer.id);
  }

  addStageEvent({
    claimId,
    stage: newStage,
    status: newStatus,
    actor: "ROBOT",
    notes:
      reasons.length > 0
        ? `Risk score: ${result.riskScore}. Reasons: ${reasons.join("; ")}`
        : `Auto-approved. Risk score: ${result.riskScore}`,
  });
}

export async function validateClaim(claimId: string): Promise<ValidationResult> {
  const claim = getClaimById(claimId);
  if (!claim) throw new Error(`Claim not found: ${claimId}`);

  const extracted = claim.extractedData;
  if (!extracted) throw new Error(`No extracted data for claim: ${claimId}`);

  // ── a. policyExists ────────────────────────────────────────────────────────
  const policyExists =
    !!extracted.policyNumber &&
    extracted.policyNumber.length >= 6;

  // ── b. documentsComplete ───────────────────────────────────────────────────
  const effectiveType = extracted.claimType ?? claim.claimType;
  const documentsComplete = checkDocumentsComplete(
    effectiveType,
    extracted.documentList
  );

  // ── c. amountWithinLimit ───────────────────────────────────────────────────
  const effectiveAmount = extracted.claimAmount ?? claim.claimAmount;
  const amountWithinLimit = effectiveAmount <= AMOUNT_LIMIT_USD;

  // ── d. riskScore ───────────────────────────────────────────────────────────
  const riskScore = computeRiskScore({
    claimAmount: effectiveAmount,
    documentsComplete,
    confidence: extracted.confidence,
    claimType: effectiveType,
    incidentDate: extracted.incidentDate ?? claim.incidentDate,
  });

  // ── isValid ────────────────────────────────────────────────────────────────
  const isValid =
    policyExists && documentsComplete && amountWithinLimit && riskScore < 70;

  // ── errors & warnings ──────────────────────────────────────────────────────
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!policyExists) errors.push("Policy number missing or invalid");
  if (!documentsComplete) errors.push("Required documents incomplete");
  if (!amountWithinLimit) errors.push(`Claim amount ${effectiveAmount} exceeds limit of ${AMOUNT_LIMIT_USD}`);
  if (riskScore >= 70) errors.push(`Risk score ${riskScore} exceeds threshold`);

  if (extracted.confidence < 0.7) warnings.push("Low extraction confidence — manual review recommended");
  if (riskScore >= 40 && riskScore < 70) warnings.push(`Elevated risk score: ${riskScore}`);
  if (extracted.missingFields.length > 0) {
    warnings.push(`Missing fields detected: ${extracted.missingFields.join(", ")}`);
  }

  const result: ValidationResult = {
    isValid,
    policyExists,
    documentsComplete,
    amountWithinLimit,
    errors,
    warnings,
    riskScore,
  };

  updateClaimValidation(claimId, result);

  addStageEvent({
    claimId,
    stage: "VALIDATION",
    status: claim.status,
    actor: "ROBOT",
    notes: `Validation complete. isValid=${isValid}, riskScore=${riskScore}`,
  });

  routeCase(claimId, result);

  return result;
}
