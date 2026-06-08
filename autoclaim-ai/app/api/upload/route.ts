import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { initDb, createClaim, addDocument, addStageEvent } from "@/lib/db";

// pdf-parse must stay server-side (serverExternalPackages in next.config.mjs)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

initDb();

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const DESCRIPTION_MAX = 2000;

// ── Email header parser ───────────────────────────────────────────────────────

interface EmailHeaders {
  from: string | null;
  subject: string | null;
  date: string | null;
  policyNumber: string | null;
  body: string;
}

function parseEmailFile(text: string): EmailHeaders {
  const lines = text.split(/\r?\n/);
  const headers: EmailHeaders = { from: null, subject: null, date: null, policyNumber: null, body: "" };
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") { bodyStart = i + 1; break; }
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) { bodyStart = i; break; }
    const [, key, value] = match;
    switch ((key ?? "").trim().toLowerCase()) {
      case "from":           headers.from = (value ?? "").trim(); break;
      case "subject":        headers.subject = (value ?? "").trim(); break;
      case "date":           headers.date = (value ?? "").trim(); break;
      case "policy-number":  headers.policyNumber = (value ?? "").trim(); break;
    }
  }

  headers.body = lines.slice(bodyStart).join("\n").trim();
  return headers;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function guessClaimantName(text: string): string {
  const m = text.match(/claimant[:\s]+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i);
  return m?.[1] ?? "Unknown Claimant";
}

function guessClaimantEmail(text: string, emailFrom: string | null): string {
  if (emailFrom) {
    const m = emailFrom.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (m) return m[0];
  }
  const m = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return m?.[0] ?? "unknown@unknown.com";
}

function guessClaimType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("accident") || t.includes("collision") || t.includes("vehicle")) return "ACCIDENT";
  if (t.includes("theft") || t.includes("stolen") || t.includes("burglary")) return "THEFT";
  if (t.includes("medical") || t.includes("hospital") || t.includes("surgery")) return "MEDICAL";
  if (t.includes("property") || t.includes("damage") || t.includes("repair")) return "PROPERTY_DAMAGE";
  if (t.includes("liability") || t.includes("lawsuit") || t.includes("injury")) return "LIABILITY";
  return "PROPERTY_DAMAGE";
}

function guessAmount(text: string): number {
  const m = text.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  if (m?.[1]) return parseFloat(m[1].replace(/,/g, ""));
  return 0;
}

function guessIncidentDate(text: string, emailDate: string | null): string {
  if (emailDate) {
    const d = new Date(emailDate);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0] as string;
  }
  const m = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (m?.[1]) return m[1];
  const m2 = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i);
  if (m2) {
    const d = new Date(m2[0]);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0] as string;
  }
  return new Date().toISOString().split("T")[0] as string;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const source = formData.get("source") as string | null;
  const policyNumberField = formData.get("policyNumber") as string | null;

  if (!file) {
    return NextResponse.json({ data: null, error: "Missing field: file" }, { status: 400 });
  }
  if (source !== "PDF" && source !== "EMAIL") {
    return NextResponse.json({ data: null, error: "source must be PDF or EMAIL" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ data: null, error: "File exceeds 10 MB limit" }, { status: 413 });
  }

  const ext = source === "PDF" ? ".pdf" : ".txt";
  const fileId = randomUUID();
  const fileName = `${fileId}${ext}`;
  const filePath = path.join(UPLOADS_DIR, fileName);
  const publicUrl = `/uploads/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ── Extract text ──────────────────────────────────────────────────────────

  let rawText = "";
  let emailHeaders: EmailHeaders | null = null;

  try {
    if (source === "PDF") {
      const parsed = await pdfParse(buffer);
      rawText = parsed.text;
    } else {
      const text = buffer.toString("utf-8");
      emailHeaders = parseEmailFile(text);
      rawText = [
        emailHeaders.subject ? `Subject: ${emailHeaders.subject}` : null,
        emailHeaders.body,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
  } catch (err) {
    console.error("[upload] text extraction error", err);
    return NextResponse.json({ data: null, error: "Failed to extract text from file" }, { status: 422 });
  }

  if (!rawText.trim()) {
    return NextResponse.json({ data: null, error: "File contains no extractable text" }, { status: 422 });
  }

  // ── Save file to disk ─────────────────────────────────────────────────────

  await writeFile(filePath, buffer);

  // ── Build claim fields from heuristics ────────────────────────────────────

  const policyNumber =
    policyNumberField?.trim() ||
    emailHeaders?.policyNumber ||
    `POL-UPLOAD-${fileId.slice(0, 8).toUpperCase()}`;

  const claimantName = guessClaimantName(rawText);
  const claimantEmail = guessClaimantEmail(rawText, emailHeaders?.from ?? null);
  const claimType = guessClaimType(rawText);
  const claimAmount = guessAmount(rawText);
  const incidentDate = guessIncidentDate(rawText, emailHeaders?.date ?? null);
  const description = rawText.slice(0, DESCRIPTION_MAX);

  // ── Create claim ──────────────────────────────────────────────────────────

  const claim = createClaim({
    policyNumber,
    claimantName,
    claimantEmail,
    claimType,
    incidentDate,
    claimAmount: claimAmount > 0 ? claimAmount : 1,
    currency: "USD",
    description,
    status: "SUBMITTED",
    priority: "MEDIUM",
    stage: "INTAKE",
    source,
    documents: [],
    extractedData: null,
    validationResult: null,
    reviewNotes: null,
    assignedTo: null,
    resolvedAt: null,
  });

  addStageEvent({
    claimId: claim.id,
    stage: "INTAKE",
    status: "SUBMITTED",
    actor: "ROBOT",
    notes: `Claim received via ${source} upload: ${file.name}`,
  });

  // ── Create document record ────────────────────────────────────────────────

  const doc = addDocument({
    claimId: claim.id,
    filename: file.name,
    fileType: file.type || (source === "PDF" ? "application/pdf" : "text/plain"),
    fileSize: file.size,
    status: "PRESENT",
  });

  // Store public URL on the claim's documents array via a direct update
  // (addDocument writes to the `documents` table; we also embed it in the
  //  claim's JSON documents array so the UI can display it immediately)
  const claimDoc = {
    id: doc.id,
    name: file.name,
    type: doc.fileType,
    status: "PRESENT" as const,
    url: publicUrl,
    uploadedAt: doc.uploadedAt,
  };

  // Persist the document entry into the claim's embedded JSON list
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const row = db.prepare("SELECT documents FROM claims WHERE id = ?").get(claim.id) as { documents: string };
  const existing = JSON.parse(row.documents) as typeof claimDoc[];
  db.prepare("UPDATE claims SET documents = ?, updatedAt = ? WHERE id = ?")
    .run(JSON.stringify([...existing, claimDoc]), new Date().toISOString(), claim.id);

  // ── Fire orchestration ────────────────────────────────────────────────────

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  fetch(`${baseUrl}/api/orchestrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimId: claim.id }),
  }).catch((err) => console.error("[upload] orchestrate fetch error", err));

  return NextResponse.json({
    data: {
      claim,
      document: doc,
      message: "Claim created and processing started",
    },
    error: null,
  }, { status: 201 });
}
