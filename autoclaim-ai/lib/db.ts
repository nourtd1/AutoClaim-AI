import { createClient, type Client, type Row } from "@libsql/client";
import { randomUUID } from "crypto";
import type {
  Claim,
  ClaimStatus,
  ClaimPriority,
  ClaimStage,
  ClaimDocument,
  ExtractedData,
  ValidationResult,
  StageEvent,
  Reviewer,
  DocumentAttachment,
} from "./types";

// ── Client singleton ──────────────────────────────────────────────────────────

let _db: Client | null = null;

export function getDb(): Client {
  if (!_db) {
    const url       = process.env.TURSO_DATABASE_URL ?? "file:./data/autoclaim.db";
    const authToken = process.env.TURSO_AUTH_TOKEN;
    _db = authToken ? createClient({ url, authToken }) : createClient({ url });
  }
  return _db;
}

// ── Row helper ────────────────────────────────────────────────────────────────

function toObj<T>(row: Row): T {
  const obj: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    obj[key] = typeof val === "bigint" ? Number(val) : val;
  }
  return obj as T;
}

// ── Schema init ───────────────────────────────────────────────────────────────

let _initDone = false;

export async function initDb(): Promise<void> {
  if (_initDone) return;
  const db = getDb();

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS claims (
      id              TEXT    PRIMARY KEY,
      policyNumber    TEXT    NOT NULL,
      claimantName    TEXT    NOT NULL,
      claimantEmail   TEXT    NOT NULL,
      claimType       TEXT    NOT NULL,
      incidentDate    TEXT    NOT NULL,
      claimAmount     REAL    NOT NULL,
      currency        TEXT    NOT NULL DEFAULT 'EUR',
      description     TEXT    NOT NULL DEFAULT '',
      status          TEXT    NOT NULL DEFAULT 'SUBMITTED',
      priority        TEXT    NOT NULL DEFAULT 'MEDIUM',
      stage           TEXT    NOT NULL DEFAULT 'INTAKE',
      source          TEXT    NOT NULL DEFAULT 'FORM',
      documents       TEXT    NOT NULL DEFAULT '[]',
      extractedData   TEXT,
      validationResult TEXT,
      reviewNotes     TEXT,
      assignedTo      TEXT,
      createdAt       TEXT    NOT NULL,
      updatedAt       TEXT    NOT NULL,
      resolvedAt      TEXT,
      deletedAt       TEXT,
      maestroInstanceId TEXT
    );

    CREATE TABLE IF NOT EXISTS stage_events (
      id        TEXT PRIMARY KEY,
      claimId   TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      stage     TEXT NOT NULL,
      status    TEXT NOT NULL,
      actor     TEXT NOT NULL,
      notes     TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id         TEXT PRIMARY KEY,
      claimId    TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
      filename   TEXT NOT NULL,
      fileType   TEXT NOT NULL,
      fileSize   INTEGER NOT NULL DEFAULT 0,
      status     TEXT NOT NULL DEFAULT 'PRESENT',
      uploadedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviewers (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      role        TEXT NOT NULL,
      isAvailable INTEGER NOT NULL DEFAULT 1
    );
  `);

  _initDone = true;
}

// ── Row interfaces ────────────────────────────────────────────────────────────

interface ClaimRow {
  id: string; policyNumber: string; claimantName: string; claimantEmail: string;
  claimType: string; incidentDate: string; claimAmount: number; currency: string;
  description: string; status: string; priority: string; stage: string; source: string;
  documents: string; extractedData: string | null; validationResult: string | null;
  reviewNotes: string | null; assignedTo: string | null;
  createdAt: string; updatedAt: string; resolvedAt: string | null; deletedAt: string | null;
}

interface StageEventRow {
  id: string; claimId: string; stage: string; status: string;
  actor: string; notes: string | null; timestamp: string;
}

interface ReviewerRow {
  id: string; name: string; email: string; role: string; isAvailable: number;
}

interface DocumentRow {
  id: string; claimId: string; filename: string; fileType: string;
  fileSize: number; status: string; uploadedAt: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function rowToClaim(row: ClaimRow): Claim {
  return {
    id: row.id, policyNumber: row.policyNumber, claimantName: row.claimantName,
    claimantEmail: row.claimantEmail, claimType: row.claimType, incidentDate: row.incidentDate,
    claimAmount: row.claimAmount, currency: row.currency, description: row.description,
    status: row.status as ClaimStatus, priority: row.priority as ClaimPriority,
    stage: row.stage as ClaimStage, source: row.source as Claim["source"],
    documents: JSON.parse(row.documents) as ClaimDocument[],
    extractedData: row.extractedData ? JSON.parse(row.extractedData) as ExtractedData : null,
    validationResult: row.validationResult ? JSON.parse(row.validationResult) as ValidationResult : null,
    reviewNotes: row.reviewNotes, assignedTo: row.assignedTo,
    createdAt: row.createdAt, updatedAt: row.updatedAt, resolvedAt: row.resolvedAt,
  };
}

function rowToStageEvent(row: StageEventRow): StageEvent {
  return {
    id: row.id, claimId: row.claimId, stage: row.stage as StageEvent["stage"],
    status: row.status as ClaimStatus, actor: row.actor as StageEvent["actor"],
    notes: row.notes, timestamp: row.timestamp,
  };
}

function rowToReviewer(row: ReviewerRow): Reviewer {
  return { id: row.id, name: row.name, email: row.email, role: row.role, isAvailable: row.isAvailable === 1 };
}

function rowToDocument(row: DocumentRow): DocumentAttachment {
  return {
    id: row.id, claimId: row.claimId, filename: row.filename,
    fileType: row.fileType, fileSize: Number(row.fileSize),
    status: row.status as DocumentAttachment["status"], uploadedAt: row.uploadedAt,
  };
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function requireClaim(id: string): Promise<Claim> {
  const claim = await getClaimById(id);
  if (!claim) throw new Error(`Claim not found: ${id}`);
  return claim;
}

// ── Claims CRUD ───────────────────────────────────────────────────────────────

export async function createClaim(data: Omit<Claim, "id" | "createdAt" | "updatedAt">): Promise<Claim> {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO claims (
      id, policyNumber, claimantName, claimantEmail, claimType,
      incidentDate, claimAmount, currency, description,
      status, priority, stage, source,
      documents, extractedData, validationResult,
      reviewNotes, assignedTo, createdAt, updatedAt, resolvedAt
    ) VALUES (
      @id, @policyNumber, @claimantName, @claimantEmail, @claimType,
      @incidentDate, @claimAmount, @currency, @description,
      @status, @priority, @stage, @source,
      @documents, @extractedData, @validationResult,
      @reviewNotes, @assignedTo, @createdAt, @updatedAt, @resolvedAt
    )`,
    args: {
      id, policyNumber: data.policyNumber, claimantName: data.claimantName,
      claimantEmail: data.claimantEmail, claimType: data.claimType,
      incidentDate: data.incidentDate, claimAmount: data.claimAmount,
      currency: data.currency, description: data.description,
      status: data.status, priority: data.priority, stage: data.stage, source: data.source,
      documents: JSON.stringify(data.documents),
      extractedData: data.extractedData ? JSON.stringify(data.extractedData) : null,
      validationResult: data.validationResult ? JSON.stringify(data.validationResult) : null,
      reviewNotes: data.reviewNotes, assignedTo: data.assignedTo,
      createdAt: now, updatedAt: now, resolvedAt: data.resolvedAt,
    },
  });

  return requireClaim(id);
}

export async function getClaimById(id: string): Promise<Claim | null> {
  const result = await getDb().execute({ sql: "SELECT * FROM claims WHERE id = ?", args: [id] });
  if (!result.rows[0]) return null;
  return rowToClaim(toObj<ClaimRow>(result.rows[0]));
}

export async function getAllClaims(filters?: { status?: ClaimStatus; priority?: ClaimPriority; source?: Claim["source"] }): Promise<Claim[]> {
  const conditions: string[] = ["deletedAt IS NULL"];
  const args: Record<string, string> = {};

  if (filters?.status)   { conditions.push("status = @status");     args["status"]   = filters.status; }
  if (filters?.priority) { conditions.push("priority = @priority"); args["priority"] = filters.priority; }
  if (filters?.source)   { conditions.push("source = @source");     args["source"]   = filters.source; }

  const result = await getDb().execute({
    sql: `SELECT * FROM claims WHERE ${conditions.join(" AND ")} ORDER BY createdAt DESC`,
    args,
  });
  return result.rows.map(r => rowToClaim(toObj<ClaimRow>(r)));
}

export async function updateClaimStatus(id: string, status: ClaimStatus, stage: ClaimStage): Promise<Claim> {
  const now = new Date().toISOString();
  const resolved = (status === "APPROVED" || status === "REJECTED") ? now : null;

  await getDb().execute({
    sql: `UPDATE claims SET status = @status, stage = @stage, updatedAt = @now,
          resolvedAt = COALESCE(@resolved, resolvedAt) WHERE id = @id`,
    args: { id, status, stage, now, resolved },
  });
  return requireClaim(id);
}

export async function updateClaimExtraction(id: string, data: ExtractedData): Promise<Claim> {
  const now = new Date().toISOString();
  await getDb().execute({
    sql: "UPDATE claims SET extractedData = @extractedData, updatedAt = @now WHERE id = @id",
    args: { id, extractedData: JSON.stringify(data), now },
  });
  return requireClaim(id);
}

export async function updateClaimValidation(id: string, result: ValidationResult): Promise<Claim> {
  const now = new Date().toISOString();
  await getDb().execute({
    sql: "UPDATE claims SET validationResult = @validationResult, updatedAt = @now WHERE id = @id",
    args: { id, validationResult: JSON.stringify(result), now },
  });
  return requireClaim(id);
}

export async function updateClaim(
  id: string,
  patch: Partial<Pick<Claim, "policyNumber"|"claimantName"|"claimantEmail"|"claimType"|"incidentDate"|"claimAmount"|"currency"|"description"|"source"|"status"|"priority"|"reviewNotes">>
): Promise<Claim> {
  const now = new Date().toISOString();
  const fields = Object.keys(patch).map(k => `${k} = @${k}`).join(", ");
  if (!fields) return requireClaim(id);
  const patchArgs = Object.fromEntries(Object.entries({ ...patch, now, id }).map(([k, v]) => [k, v as string | number | null]));
  await getDb().execute({ sql: `UPDATE claims SET ${fields}, updatedAt = @now WHERE id = @id`, args: patchArgs });
  return requireClaim(id);
}

export async function softDeleteClaim(id: string): Promise<void> {
  const now = new Date().toISOString();
  await getDb().execute({
    sql: "UPDATE claims SET deletedAt = @now, updatedAt = @now WHERE id = @id",
    args: { now, id },
  });
}

// ── Stage events ──────────────────────────────────────────────────────────────

export async function addStageEvent(event: Omit<StageEvent, "id" | "timestamp">): Promise<StageEvent> {
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  await getDb().execute({
    sql: `INSERT INTO stage_events (id, claimId, stage, status, actor, notes, timestamp)
          VALUES (@id, @claimId, @stage, @status, @actor, @notes, @timestamp)`,
    args: { id, ...event, timestamp },
  });

  const result = await getDb().execute({ sql: "SELECT * FROM stage_events WHERE id = ?", args: [id] });
  if (!result.rows[0]) throw new Error(`Stage event not found after insert: ${id}`);
  return rowToStageEvent(toObj<StageEventRow>(result.rows[0]));
}

export async function getClaimTimeline(claimId: string): Promise<StageEvent[]> {
  const result = await getDb().execute({
    sql: "SELECT * FROM stage_events WHERE claimId = ? ORDER BY timestamp ASC",
    args: [claimId],
  });
  return result.rows.map(r => rowToStageEvent(toObj<StageEventRow>(r)));
}

export interface RecentStageEvent extends StageEvent { claimantName: string; }

export async function getRecentStageEvents(limit: number): Promise<RecentStageEvent[]> {
  const result = await getDb().execute({
    sql: `SELECT se.*, c.claimantName FROM stage_events se
          JOIN claims c ON c.id = se.claimId
          WHERE c.deletedAt IS NULL ORDER BY se.timestamp DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows.map(r => {
    const obj = toObj<StageEventRow & { claimantName: string }>(r);
    return { ...rowToStageEvent(obj), claimantName: obj.claimantName };
  });
}

// ── Reviewers ─────────────────────────────────────────────────────────────────

export async function assignReviewer(claimId: string, reviewerId: string): Promise<void> {
  const now = new Date().toISOString();
  await getDb().execute({
    sql: "UPDATE claims SET assignedTo = @reviewerId, updatedAt = @now WHERE id = @claimId",
    args: { claimId, reviewerId, now },
  });
}

export async function getAvailableReviewers(): Promise<Reviewer[]> {
  const result = await getDb().execute({ sql: "SELECT * FROM reviewers WHERE isAvailable = 1", args: [] });
  return result.rows.map(r => rowToReviewer(toObj<ReviewerRow>(r)));
}

export async function getReviewerById(id: string): Promise<Reviewer | null> {
  const result = await getDb().execute({ sql: "SELECT * FROM reviewers WHERE id = ?", args: [id] });
  if (!result.rows[0]) return null;
  return rowToReviewer(toObj<ReviewerRow>(result.rows[0]));
}

export async function getReviewersByRole(role: string): Promise<Reviewer[]> {
  const result = await getDb().execute({
    sql: "SELECT * FROM reviewers WHERE role = ? AND isAvailable = 1",
    args: [role],
  });
  return result.rows.map(r => rowToReviewer(toObj<ReviewerRow>(r)));
}

export async function getAllReviewers(): Promise<Reviewer[]> {
  const result = await getDb().execute({ sql: "SELECT * FROM reviewers", args: [] });
  return result.rows.map(r => rowToReviewer(toObj<ReviewerRow>(r)));
}

export async function setReviewerAvailability(id: string, isAvailable: boolean): Promise<Reviewer> {
  await getDb().execute({
    sql: "UPDATE reviewers SET isAvailable = ? WHERE id = ?",
    args: [isAvailable ? 1 : 0, id],
  });
  const result = await getDb().execute({ sql: "SELECT * FROM reviewers WHERE id = ?", args: [id] });
  if (!result.rows[0]) throw new Error(`Reviewer not found: ${id}`);
  return rowToReviewer(toObj<ReviewerRow>(result.rows[0]));
}

export async function getClaimsByReviewer(reviewerId: string): Promise<Claim[]> {
  const result = await getDb().execute({
    sql: "SELECT * FROM claims WHERE assignedTo = ? AND deletedAt IS NULL ORDER BY createdAt DESC",
    args: [reviewerId],
  });
  return result.rows.map(r => rowToClaim(toObj<ClaimRow>(r)));
}

export async function createReviewer(reviewer: Omit<Reviewer, "id">): Promise<Reviewer> {
  const id = randomUUID();
  await getDb().execute({
    sql: `INSERT OR IGNORE INTO reviewers (id, name, email, role, isAvailable)
          VALUES (@id, @name, @email, @role, @isAvailable)`,
    args: { id, name: reviewer.name, email: reviewer.email, role: reviewer.role, isAvailable: reviewer.isAvailable ? 1 : 0 },
  });
  const result = await getDb().execute({ sql: "SELECT * FROM reviewers WHERE email = ?", args: [reviewer.email] });
  if (!result.rows[0]) throw new Error(`Reviewer not found after insert: ${reviewer.email}`);
  return rowToReviewer(toObj<ReviewerRow>(result.rows[0]));
}

// ── Maestro ───────────────────────────────────────────────────────────────────

export async function setMaestroInstanceId(claimId: string, maestroInstanceId: string): Promise<void> {
  await getDb().execute({
    sql: "UPDATE claims SET maestroInstanceId = ?, updatedAt = ? WHERE id = ?",
    args: [maestroInstanceId, new Date().toISOString(), claimId],
  });
}

export async function getMaestroInstanceId(claimId: string): Promise<string | null> {
  const result = await getDb().execute({
    sql: "SELECT maestroInstanceId FROM claims WHERE id = ?",
    args: [claimId],
  });
  const row = result.rows[0];
  return row ? (row.maestroInstanceId as string | null) : null;
}

// ── Review notes ──────────────────────────────────────────────────────────────

export async function appendReviewNotes(id: string, notes: string): Promise<Claim> {
  const claim = await requireClaim(id);
  const combined = claim.reviewNotes ? `${claim.reviewNotes}\n---\n${notes}` : notes;
  const now = new Date().toISOString();
  await getDb().execute({
    sql: "UPDATE claims SET reviewNotes = @notes, updatedAt = @now WHERE id = @id",
    args: { notes: combined, now, id },
  });
  return requireClaim(id);
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function addDocument(doc: Omit<DocumentAttachment, "id" | "uploadedAt">): Promise<DocumentAttachment> {
  const id = randomUUID();
  const uploadedAt = new Date().toISOString();
  await getDb().execute({
    sql: `INSERT INTO documents (id, claimId, filename, fileType, fileSize, status, uploadedAt)
          VALUES (@id, @claimId, @filename, @fileType, @fileSize, @status, @uploadedAt)`,
    args: { id, ...doc, uploadedAt },
  });
  const result = await getDb().execute({ sql: "SELECT * FROM documents WHERE id = ?", args: [id] });
  if (!result.rows[0]) throw new Error(`Document not found after insert: ${id}`);
  return rowToDocument(toObj<DocumentRow>(result.rows[0]));
}

export async function getClaimDocuments(claimId: string): Promise<DocumentAttachment[]> {
  const result = await getDb().execute({
    sql: "SELECT * FROM documents WHERE claimId = ? ORDER BY uploadedAt ASC",
    args: [claimId],
  });
  return result.rows.map(r => rowToDocument(toObj<DocumentRow>(r)));
}
