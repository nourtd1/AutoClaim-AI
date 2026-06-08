/**
 * AutoClaim AI — Full workflow demo script
 * Run with:  npm run demo
 *
 * Simulates the complete Maestro orchestration in ~60 seconds.
 * Uses the DB layer directly (no Anthropic API calls) so it works
 * without an API key and completes deterministically.
 */

import Database from "better-sqlite3";
import path from "path";
import {
  initDb,
  getDb,
  createClaim,
  createReviewer,
  addStageEvent,
  updateClaimExtraction,
  updateClaimValidation,
  updateClaimStatus,
  assignReviewer,
  appendReviewNotes,
  getAvailableReviewers,
  getAllClaims,
} from "../lib/db";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function log(msg: string) {
  console.log(`[${ts()}]  ${msg}`);
}

function section(title: string) {
  const line = "─".repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(`${line}`);
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Reset DB ──────────────────────────────────────────────────────────────────

function resetDb() {
  const db = getDb();
  db.exec(`
    DELETE FROM stage_events;
    DELETE FROM documents;
    DELETE FROM claims;
    DELETE FROM reviewers;
  `);
  log("✓ Database reset — all tables cleared");
}

// ── Simulated agent helpers ───────────────────────────────────────────────────
// These bypass the Anthropic API and produce deterministic mock data.

function simulateExtraction(
  claimId: string,
  overrides: {
    confidence: number;
    policyNumber: string;
    documentList: string[];
    claimAmount: number;
    claimType: string;
    incidentDate: string;
    missingFields?: string[];
  }
) {
  const extracted = {
    confidence: overrides.confidence,
    policyNumber: overrides.policyNumber,
    claimantName: null,
    incidentDate: overrides.incidentDate,
    claimAmount: overrides.claimAmount,
    claimType: overrides.claimType,
    documentList: overrides.documentList,
    rawText: "[demo — simulated extraction]",
    missingFields: overrides.missingFields ?? [],
  };
  if (extracted.confidence < 0.6 && !extracted.missingFields.includes("confidence_low")) {
    extracted.missingFields.push("confidence_low");
  }
  updateClaimExtraction(claimId, extracted);
  return extracted;
}

const REQUIRED_DOCS: Record<string, string[]> = {
  ACCIDENT:        ["police_report", "photos", "medical_certificate"],
  THEFT:           ["police_report", "inventory_list"],
  MEDICAL:         ["medical_certificate", "receipts"],
  PROPERTY_DAMAGE: ["photos", "repair_estimate"],
  LIABILITY:       ["incident_report", "witness_statements"],
};

function simulateValidation(claimId: string) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM claims WHERE id = ?").get(claimId) as {
    extractedData: string;
    claimAmount: number;
    claimType: string;
    incidentDate: string;
    policyNumber: string;
  };
  const ex = JSON.parse(row.extractedData);

  const policyExists = !!ex.policyNumber && ex.policyNumber.length >= 6;

  const required = REQUIRED_DOCS[ex.claimType?.toUpperCase() ?? ""] ?? [];
  const documentsComplete =
    required.length === 0 ||
    required.every((r: string) =>
      ex.documentList.some((d: string) => d.toLowerCase().includes(r.toLowerCase()))
    );

  const effectiveAmount = ex.claimAmount ?? row.claimAmount;
  const amountWithinLimit = effectiveAmount <= 50_000;

  let riskScore = 0;
  if (effectiveAmount > 25_000) riskScore += 30;
  if (!documentsComplete)       riskScore += 20;
  if (ex.confidence < 0.7)      riskScore += 25;
  if (ex.claimType?.toUpperCase() === "LIABILITY") riskScore += 15;
  const daysElapsed = (Date.now() - new Date(ex.incidentDate).getTime()) / 86_400_000;
  if (daysElapsed > 365)        riskScore += 10;
  riskScore = Math.min(riskScore, 100);

  const isValid = policyExists && documentsComplete && amountWithinLimit && riskScore < 70;

  const errors: string[] = [];
  const warnings: string[] = [];
  if (!policyExists)       errors.push("Policy number missing or invalid");
  if (!documentsComplete)  errors.push("Required documents incomplete");
  if (!amountWithinLimit)  errors.push(`Claim amount ${effectiveAmount} exceeds limit of 50,000`);
  if (riskScore >= 70)     errors.push(`Risk score ${riskScore} exceeds threshold`);
  if (ex.confidence < 0.7) warnings.push(`Low extraction confidence (${Math.round(ex.confidence * 100)}%)`);
  if (riskScore >= 40 && riskScore < 70) warnings.push(`Elevated risk score: ${riskScore}`);

  const result = { isValid, policyExists, documentsComplete, amountWithinLimit, errors, warnings, riskScore };
  updateClaimValidation(claimId, result);
  return result;
}

function routeAndLog(
  claimId: string,
  claimantName: string,
  result: ReturnType<typeof simulateValidation>,
  reviewers: { id: string; name: string; role: string }[]
) {
  let newStatus: "APPROVED" | "PENDING_REVIEW" | "ESCALATED";
  let newStage: "RESOLUTION" | "HUMAN_REVIEW" | "EXCEPTION_ROUTING";
  const reasons: string[] = [];

  if (!result.amountWithinLimit) {
    newStatus = "ESCALATED"; newStage = "HUMAN_REVIEW";
    reasons.push("Amount exceeds hard limit");
  } else if (result.riskScore >= 70) {
    newStatus = "ESCALATED"; newStage = "HUMAN_REVIEW";
    reasons.push(`Risk score too high: ${result.riskScore}`);
  } else if (!result.isValid && result.errors.length > 0) {
    newStatus = "PENDING_REVIEW"; newStage = "EXCEPTION_ROUTING";
    reasons.push(...result.errors);
  } else if (result.isValid && result.riskScore >= 40) {
    newStatus = "PENDING_REVIEW"; newStage = "HUMAN_REVIEW";
    reasons.push(`Moderate risk score: ${result.riskScore}`);
  } else {
    newStatus = "APPROVED"; newStage = "RESOLUTION";
  }

  updateClaimStatus(claimId, newStatus, newStage);

  if (newStatus !== "APPROVED" && reviewers.length > 0) {
    const reviewer = reviewers[0];
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

  return { newStatus, newStage, reasons };
}

// ── Main demo ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║         AutoClaim AI — UiPath AgentHack 2026 Demo           ║");
  console.log("║         Full workflow simulation (~60 seconds)              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // ── Step 0: Reset + seed ──────────────────────────────────────────────────
  section("Step 0 — Reset & Seed");
  initDb();
  resetDb();

  const alice = createReviewer({ name: "Alice Martin",  email: "alice@autoclaim.io", role: "Senior Adjuster",    isAvailable: true });
  const bob   = createReviewer({ name: "Bob Diallo",    email: "bob@autoclaim.io",   role: "Claims Investigator", isAvailable: true });
  const fatima = createReviewer({ name: "Fatima Ndiaye", email: "fatima@autoclaim.io", role: "Compliance Officer", isAvailable: true });
  log(`✓ Reviewers created: ${alice.name}, ${bob.name}, ${fatima.name}`);
  await delay(800);

  // ── Step 1: Scenario A — simple claim → auto APPROVED ────────────────────
  section("Step 1 — Scenario A: Simple Property Damage Claim ($850)");
  log("📥 Submitting claim via web form…");

  const claimA = createClaim({
    policyNumber: "POL-DEMO-001",
    claimantName: "Emma Dubois",
    claimantEmail: "emma.dubois@email.com",
    claimType: "PROPERTY_DAMAGE",
    incidentDate: "2026-05-20",
    claimAmount: 850,
    currency: "USD",
    description: "Window broken during storm. Minor property damage. Repair estimate attached. Photos included.",
    status: "SUBMITTED",
    priority: "LOW",
    stage: "INTAKE",
    source: "FORM",
    documents: [],
    extractedData: null,
    validationResult: null,
    reviewNotes: null,
    assignedTo: null,
    resolvedAt: null,
  });
  addStageEvent({ claimId: claimA.id, stage: "INTAKE", status: "SUBMITTED", actor: "ROBOT", notes: "Claim received via web form" });
  log(`   Claim ID: ${claimA.id.slice(0, 8)}…`);
  await delay(1000);

  log("🧠 Agent: Extracting claim data…");
  updateClaimStatus(claimA.id, "EXTRACTING", "EXTRACTION");
  await delay(1500);
  const exA = simulateExtraction(claimA.id, {
    confidence: 0.94,
    policyNumber: "POL-DEMO-001",
    documentList: ["photos_damage.jpg", "repair_estimate.pdf"],
    claimAmount: 850,
    claimType: "PROPERTY_DAMAGE",
    incidentDate: "2026-05-20",
  });
  addStageEvent({ claimId: claimA.id, stage: "EXTRACTION", status: "VALIDATING", actor: "AGENT", notes: `Extracted by Claude AI, confidence: ${exA.confidence.toFixed(2)}` });
  log(`   ✓ Extraction complete — confidence: ${Math.round(exA.confidence * 100)}%`);
  await delay(1000);

  log("⚙️  Robot: Validating policy & documents…");
  updateClaimStatus(claimA.id, "VALIDATING", "VALIDATION");
  await delay(1200);
  const vrA = simulateValidation(claimA.id);
  addStageEvent({ claimId: claimA.id, stage: "VALIDATION", status: "VALIDATING", actor: "ROBOT", notes: `isValid=${vrA.isValid}, riskScore=${vrA.riskScore}` });
  log(`   ✓ Validation complete — risk score: ${vrA.riskScore}/100`);
  await delay(800);

  const routeA = routeAndLog(claimA.id, claimA.claimantName, vrA, []);
  log(`✅ APPROVED — Auto-resolved (risk ${vrA.riskScore} < 40, all checks passed)\n`);
  await delay(2000);

  // ── Step 2: Scenario B — medical $45K → PENDING_REVIEW ───────────────────
  section("Step 2 — Scenario B: High-Value Medical Claim ($45,000)");
  log("📥 Submitting claim via email upload…");

  const claimB = createClaim({
    policyNumber: "POL-DEMO-002",
    claimantName: "Marcus Chen",
    claimantEmail: "marcus.chen@email.com",
    claimType: "MEDICAL",
    incidentDate: "2026-04-10",
    claimAmount: 45000,
    currency: "USD",
    description: "Emergency surgery and ICU stay. Appendectomy plus post-operative care. Total hospital cost $45,000.",
    status: "SUBMITTED",
    priority: "HIGH",
    stage: "INTAKE",
    source: "EMAIL",
    documents: [],
    extractedData: null,
    validationResult: null,
    reviewNotes: null,
    assignedTo: null,
    resolvedAt: null,
  });
  addStageEvent({ claimId: claimB.id, stage: "INTAKE", status: "SUBMITTED", actor: "ROBOT", notes: "Claim received via email" });
  log(`   Claim ID: ${claimB.id.slice(0, 8)}…`);
  await delay(1000);

  log("🧠 Agent: Extracting claim data…");
  updateClaimStatus(claimB.id, "EXTRACTING", "EXTRACTION");
  await delay(1500);
  // Confidence 0.68 → triggers +25 risk; amount >25K → +30; total=55 → PENDING_REVIEW
  const exB = simulateExtraction(claimB.id, {
    confidence: 0.68,
    policyNumber: "POL-DEMO-002",
    documentList: ["medical_certificate.pdf", "hospital_receipts.pdf"],
    claimAmount: 45000,
    claimType: "MEDICAL",
    incidentDate: "2026-04-10",
  });
  addStageEvent({ claimId: claimB.id, stage: "EXTRACTION", status: "VALIDATING", actor: "AGENT", notes: `Extracted by Claude AI, confidence: ${exB.confidence.toFixed(2)}` });
  log(`   ✓ Extraction complete — confidence: ${Math.round(exB.confidence * 100)}% (below 0.70 threshold)`);
  await delay(1000);

  log("⚙️  Robot: Validating policy & risk…");
  updateClaimStatus(claimB.id, "VALIDATING", "VALIDATION");
  await delay(1200);
  const vrB = simulateValidation(claimB.id);
  addStageEvent({ claimId: claimB.id, stage: "VALIDATION", status: "VALIDATING", actor: "ROBOT", notes: `isValid=${vrB.isValid}, riskScore=${vrB.riskScore}` });
  log(`   ✓ Validation complete — risk score: ${vrB.riskScore}/100`);
  await delay(800);

  const routeB = routeAndLog(claimB.id, claimB.claimantName, vrB, [alice]);
  log(`⚠️  High-value claim routed to human review`);
  log(`   Status: ${routeB.newStatus} → assigned to ${alice.name}`);
  log(`   Reasons: ${routeB.reasons.join(", ")}\n`);
  await delay(2000);

  // ── Step 3: Scenario C — theft, missing docs → EXCEPTION_ROUTING ─────────
  section("Step 3 — Scenario C: Theft Claim — Missing Documents");
  log("📥 Submitting theft claim…");

  const claimC = createClaim({
    policyNumber: "POL-DEMO-003",
    claimantName: "Sofia Reyes",
    claimantEmail: "sofia.reyes@email.com",
    claimType: "THEFT",
    incidentDate: "2026-06-01",
    claimAmount: 8500,
    currency: "USD",
    description: "Residential burglary. Electronics and jewellery stolen. Police report pending. No inventory list available yet.",
    status: "SUBMITTED",
    priority: "MEDIUM",
    stage: "INTAKE",
    source: "FORM",
    documents: [],
    extractedData: null,
    validationResult: null,
    reviewNotes: null,
    assignedTo: null,
    resolvedAt: null,
  });
  addStageEvent({ claimId: claimC.id, stage: "INTAKE", status: "SUBMITTED", actor: "ROBOT", notes: "Claim received via form" });
  log(`   Claim ID: ${claimC.id.slice(0, 8)}…`);
  await delay(1000);

  log("🧠 Agent: Extracting claim data…");
  updateClaimStatus(claimC.id, "EXTRACTING", "EXTRACTION");
  await delay(1500);
  // THEFT requires police_report + inventory_list. We provide neither → documentsComplete=false → +20 risk
  const exC = simulateExtraction(claimC.id, {
    confidence: 0.82,
    policyNumber: "POL-DEMO-003",
    documentList: [],
    claimAmount: 8500,
    claimType: "THEFT",
    incidentDate: "2026-06-01",
    missingFields: ["police_report", "inventory_list"],
  });
  addStageEvent({ claimId: claimC.id, stage: "EXTRACTION", status: "VALIDATING", actor: "AGENT", notes: `Extracted by Claude AI, confidence: ${exC.confidence.toFixed(2)}` });
  log(`   ⚠ Missing documents detected: police_report, inventory_list`);
  await delay(1000);

  log("⚙️  Robot: Validating…");
  updateClaimStatus(claimC.id, "VALIDATING", "VALIDATION");
  await delay(1200);
  const vrC = simulateValidation(claimC.id);
  addStageEvent({ claimId: claimC.id, stage: "VALIDATION", status: "VALIDATING", actor: "ROBOT", notes: `isValid=${vrC.isValid}, riskScore=${vrC.riskScore}` });
  await delay(800);

  const routeC = routeAndLog(claimC.id, claimC.claimantName, vrC, [bob]);
  log(`❌ Missing documents detected — exception route triggered`);
  log(`   Status: ${routeC.newStatus} / Stage: ${routeC.newStage}`);
  log(`   Errors: ${vrC.errors.join(", ")}\n`);
  await delay(2000);

  // ── Step 4: Human decision on claim B ─────────────────────────────────────
  section("Step 4 — Human Review: Alice approves Claim B");
  log(`👤 Reviewer ${alice.name} opens claim ${claimB.id.slice(0, 8)}…`);
  await delay(1500);

  log("   Reading extraction results, validation report…");
  await delay(2000);

  log("   Entering decision: APPROVE");
  const reviewNotes = "All documents verified manually. Surgery confirmed by hospital records. Amount within policy coverage. Approved.";
  appendReviewNotes(claimB.id, reviewNotes);
  updateClaimStatus(claimB.id, "APPROVED", "RESOLUTION");
  addStageEvent({
    claimId: claimB.id,
    stage: "RESOLUTION",
    status: "APPROVED",
    actor: "HUMAN",
    notes: `APPROVE: ${reviewNotes}`,
  });
  await delay(1000);
  log(`✅ Human reviewer approved claim — ${claimB.claimantName}\n`);
  await delay(1500);

  // ── Step 5: Final stats ───────────────────────────────────────────────────
  section("Step 5 — Final Stats");
  await delay(500);

  const allClaims = getAllClaims();
  const approved    = allClaims.filter((c) => c.status === "APPROVED").length;
  const pending     = allClaims.filter((c) => c.status === "PENDING_REVIEW").length;
  const escalated   = allClaims.filter((c) => c.status === "ESCALATED").length;
  const humanDecisions = allClaims.filter(
    (c) => (c.status === "APPROVED" || c.status === "REJECTED")
  ).length;

  // Count auto-approved (approved with no HUMAN stage event)
  const db = getDb();
  const approvedIds = allClaims.filter((c) => c.status === "APPROVED").map((c) => c.id);
  let autoApproved = 0;
  for (const id of approvedIds) {
    const humanEvent = db.prepare(
      "SELECT 1 FROM stage_events WHERE claimId = ? AND actor = 'HUMAN' LIMIT 1"
    ).get(id);
    if (!humanEvent) autoApproved++;
  }
  const humanReviewed = humanDecisions - autoApproved;

  console.log(`
  ┌──────────────────────────────────────────┐
  │           Demo Results Summary           │
  ├──────────────────────────────────────────┤
  │  Total claims processed    :  ${String(allClaims.length).padEnd(8)}  │
  │  Auto-resolved by AI       :  ${String(autoApproved).padEnd(8)}  │
  │  Approved by human review  :  ${String(humanReviewed).padEnd(8)}  │
  │  Pending review (open)     :  ${String(pending).padEnd(8)}  │
  │  Escalated                 :  ${String(escalated).padEnd(8)}  │
  ├──────────────────────────────────────────┤
  │  Auto-approval rate        :  ${String(allClaims.length > 0 ? Math.round((autoApproved / allClaims.length) * 100) + "%" : "—").padEnd(8)}  │
  └──────────────────────────────────────────┘
  `);

  log("🏁 Demo complete. Start the dev server to explore the UI:");
  log("   npm run dev  →  http://localhost:3000\n");
}

main().catch((err) => {
  console.error("\n❌ Demo failed:", err);
  process.exit(1);
});
