import Database from "better-sqlite3";
import path from "path";
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

// ── DB path ───────────────────────────────────────────────────────────────────

const DB_PATH = path.join(process.cwd(), "data", "autoclaim.db");

// ── Singleton ─────────────────────────────────────────────────────────────────

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}

// ── Migrations ────────────────────────────────────────────────────────────────

export function initDb(): void {
  const db = getDb();

  db.exec(`
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
      deletedAt       TEXT
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

  // idempotent migrations
  const cols = db
    .prepare("PRAGMA table_info(claims)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "deletedAt")) {
    db.exec("ALTER TABLE claims ADD COLUMN deletedAt TEXT");
  }
  const freshCols = db.prepare("PRAGMA table_info(claims)").all() as { name: string }[];
  if (!freshCols.some((c) => c.name === "maestroInstanceId")) {
    db.exec("ALTER TABLE claims ADD COLUMN maestroInstanceId TEXT");
  }
}

// ── Row → domain mappers ──────────────────────────────────────────────────────

interface ClaimRow {
  id: string;
  policyNumber: string;
  claimantName: string;
  claimantEmail: string;
  claimType: string;
  incidentDate: string;
  claimAmount: number;
  currency: string;
  description: string;
  status: string;
  priority: string;
  stage: string;
  source: string;
  documents: string;
  extractedData: string | null;
  validationResult: string | null;
  reviewNotes: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  deletedAt: string | null;
}

interface StageEventRow {
  id: string;
  claimId: string;
  stage: string;
  status: string;
  actor: string;
  notes: string | null;
  timestamp: string;
}

interface ReviewerRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isAvailable: number;
}

interface DocumentRow {
  id: string;
  claimId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: string;
  uploadedAt: string;
}

function rowToClaim(row: ClaimRow): Claim {
  return {
    id: row.id,
    policyNumber: row.policyNumber,
    claimantName: row.claimantName,
    claimantEmail: row.claimantEmail,
    claimType: row.claimType,
    incidentDate: row.incidentDate,
    claimAmount: row.claimAmount,
    currency: row.currency,
    description: row.description,
    status: row.status as ClaimStatus,
    priority: row.priority as ClaimPriority,
    stage: row.stage as ClaimStage,
    source: row.source as Claim["source"],
    documents: JSON.parse(row.documents) as ClaimDocument[],
    extractedData: row.extractedData
      ? (JSON.parse(row.extractedData) as ExtractedData)
      : null,
    validationResult: row.validationResult
      ? (JSON.parse(row.validationResult) as ValidationResult)
      : null,
    reviewNotes: row.reviewNotes,
    assignedTo: row.assignedTo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
  };
}

function rowToStageEvent(row: StageEventRow): StageEvent {
  return {
    id: row.id,
    claimId: row.claimId,
    stage: row.stage as StageEvent["stage"],
    status: row.status as ClaimStatus,
    actor: row.actor as StageEvent["actor"],
    notes: row.notes,
    timestamp: row.timestamp,
  };
}

function rowToReviewer(row: ReviewerRow): Reviewer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isAvailable: row.isAvailable === 1,
  };
}

function rowToDocument(row: DocumentRow): DocumentAttachment {
  return {
    id: row.id,
    claimId: row.claimId,
    filename: row.filename,
    fileType: row.fileType,
    fileSize: row.fileSize,
    status: row.status as DocumentAttachment["status"],
    uploadedAt: row.uploadedAt,
  };
}

// ── Helper: require a claim to exist ─────────────────────────────────────────

function requireClaim(id: string): Claim {
  const claim = getClaimById(id);
  if (!claim) throw new Error(`Claim not found: ${id}`);
  return claim;
}

// ── Claims CRUD ───────────────────────────────────────────────────────────────

export function createClaim(
  data: Omit<Claim, "id" | "createdAt" | "updatedAt">
): Claim {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO claims (
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
    )
  `).run({
    id,
    policyNumber: data.policyNumber,
    claimantName: data.claimantName,
    claimantEmail: data.claimantEmail,
    claimType: data.claimType,
    incidentDate: data.incidentDate,
    claimAmount: data.claimAmount,
    currency: data.currency,
    description: data.description,
    status: data.status,
    priority: data.priority,
    stage: data.stage,
    source: data.source,
    documents: JSON.stringify(data.documents),
    extractedData: data.extractedData ? JSON.stringify(data.extractedData) : null,
    validationResult: data.validationResult
      ? JSON.stringify(data.validationResult)
      : null,
    reviewNotes: data.reviewNotes,
    assignedTo: data.assignedTo,
    createdAt: now,
    updatedAt: now,
    resolvedAt: data.resolvedAt,
  });

  return requireClaim(id);
}

export function getClaimById(id: string): Claim | null {
  const row = getDb()
    .prepare("SELECT * FROM claims WHERE id = ?")
    .get(id) as ClaimRow | undefined;
  return row ? rowToClaim(row) : null;
}

export function getAllClaims(filters?: {
  status?: ClaimStatus;
  priority?: ClaimPriority;
  source?: Claim["source"];
}): Claim[] {
  const conditions: string[] = ["deletedAt IS NULL"];
  const params: Record<string, string> = {};

  if (filters?.status) {
    conditions.push("status = @status");
    params["status"] = filters.status;
  }
  if (filters?.priority) {
    conditions.push("priority = @priority");
    params["priority"] = filters.priority;
  }
  if (filters?.source) {
    conditions.push("source = @source");
    params["source"] = filters.source;
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const rows = getDb()
    .prepare(`SELECT * FROM claims ${where} ORDER BY createdAt DESC`)
    .all(params) as ClaimRow[];

  return rows.map(rowToClaim);
}

export function updateClaimStatus(
  id: string,
  status: ClaimStatus,
  stage: ClaimStage
): Claim {
  const now = new Date().toISOString();
  const resolved =
    status === "APPROVED" || status === "REJECTED" ? now : null;

  getDb()
    .prepare(`
      UPDATE claims
      SET status = @status, stage = @stage, updatedAt = @now,
          resolvedAt = COALESCE(@resolved, resolvedAt)
      WHERE id = @id
    `)
    .run({ id, status, stage, now, resolved });

  return requireClaim(id);
}

export function updateClaimExtraction(
  id: string,
  data: ExtractedData
): Claim {
  const now = new Date().toISOString();
  getDb()
    .prepare(`
      UPDATE claims
      SET extractedData = @extractedData, updatedAt = @now
      WHERE id = @id
    `)
    .run({ id, extractedData: JSON.stringify(data), now });

  return requireClaim(id);
}

export function updateClaimValidation(
  id: string,
  result: ValidationResult
): Claim {
  const now = new Date().toISOString();
  getDb()
    .prepare(`
      UPDATE claims
      SET validationResult = @validationResult, updatedAt = @now
      WHERE id = @id
    `)
    .run({ id, validationResult: JSON.stringify(result), now });

  return requireClaim(id);
}

export function updateClaim(
  id: string,
  patch: Partial<
    Pick<
      Claim,
      | "policyNumber"
      | "claimantName"
      | "claimantEmail"
      | "claimType"
      | "incidentDate"
      | "claimAmount"
      | "currency"
      | "description"
      | "source"
      | "status"
      | "priority"
      | "reviewNotes"
    >
  >
): Claim {
  const now = new Date().toISOString();
  const fields = Object.keys(patch)
    .map((k) => `${k} = @${k}`)
    .join(", ");

  if (!fields) return requireClaim(id);

  getDb()
    .prepare(`UPDATE claims SET ${fields}, updatedAt = @now WHERE id = @id`)
    .run({ ...patch, now, id });

  return requireClaim(id);
}

export function softDeleteClaim(id: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE claims SET deletedAt = @now, updatedAt = @now WHERE id = @id")
    .run({ now, id });
}

// ── Stage events ──────────────────────────────────────────────────────────────

export function addStageEvent(
  event: Omit<StageEvent, "id" | "timestamp">
): StageEvent {
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  getDb()
    .prepare(`
      INSERT INTO stage_events (id, claimId, stage, status, actor, notes, timestamp)
      VALUES (@id, @claimId, @stage, @status, @actor, @notes, @timestamp)
    `)
    .run({ id, ...event, timestamp });

  const row = getDb()
    .prepare("SELECT * FROM stage_events WHERE id = ?")
    .get(id) as StageEventRow;
  return rowToStageEvent(row);
}

export function getClaimTimeline(claimId: string): StageEvent[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM stage_events WHERE claimId = ? ORDER BY timestamp ASC"
    )
    .all(claimId) as StageEventRow[];
  return rows.map(rowToStageEvent);
}

export interface RecentStageEvent extends StageEvent {
  claimantName: string;
}

export function getRecentStageEvents(limit: number): RecentStageEvent[] {
  const rows = getDb()
    .prepare(
      `SELECT se.*, c.claimantName
       FROM stage_events se
       JOIN claims c ON c.id = se.claimId
       WHERE c.deletedAt IS NULL
       ORDER BY se.timestamp DESC
       LIMIT ?`
    )
    .all(limit) as (StageEventRow & { claimantName: string })[];
  return rows.map((row) => ({ ...rowToStageEvent(row), claimantName: row.claimantName }));
}

// ── Reviewer assignment ───────────────────────────────────────────────────────

export function assignReviewer(claimId: string, reviewerId: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(`
      UPDATE claims
      SET assignedTo = @reviewerId, updatedAt = @now
      WHERE id = @claimId
    `)
    .run({ claimId, reviewerId, now });
}

export function getAvailableReviewers(): Reviewer[] {
  const rows = getDb()
    .prepare("SELECT * FROM reviewers WHERE isAvailable = 1")
    .all() as ReviewerRow[];
  return rows.map(rowToReviewer);
}

export function getReviewerById(id: string): Reviewer | null {
  const row = getDb()
    .prepare("SELECT * FROM reviewers WHERE id = ?")
    .get(id) as ReviewerRow | undefined;
  return row ? rowToReviewer(row) : null;
}

export function getReviewersByRole(role: string): Reviewer[] {
  const rows = getDb()
    .prepare("SELECT * FROM reviewers WHERE role = ? AND isAvailable = 1")
    .all(role) as ReviewerRow[];
  return rows.map(rowToReviewer);
}

export function setMaestroInstanceId(claimId: string, maestroInstanceId: string): void {
  getDb()
    .prepare("UPDATE claims SET maestroInstanceId = ?, updatedAt = ? WHERE id = ?")
    .run(maestroInstanceId, new Date().toISOString(), claimId);
}

export function getMaestroInstanceId(claimId: string): string | null {
  const row = getDb()
    .prepare("SELECT maestroInstanceId FROM claims WHERE id = ?")
    .get(claimId) as { maestroInstanceId: string | null } | undefined;
  return row?.maestroInstanceId ?? null;
}

export function appendReviewNotes(id: string, notes: string): Claim {
  const claim = requireClaim(id);
  const combined = claim.reviewNotes
    ? `${claim.reviewNotes}\n---\n${notes}`
    : notes;
  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE claims SET reviewNotes = @notes, updatedAt = @now WHERE id = @id")
    .run({ notes: combined, now, id });
  return requireClaim(id);
}

// ── Documents ─────────────────────────────────────────────────────────────────

export function addDocument(
  doc: Omit<DocumentAttachment, "id" | "uploadedAt">
): DocumentAttachment {
  const id = randomUUID();
  const uploadedAt = new Date().toISOString();

  getDb()
    .prepare(`
      INSERT INTO documents (id, claimId, filename, fileType, fileSize, status, uploadedAt)
      VALUES (@id, @claimId, @filename, @fileType, @fileSize, @status, @uploadedAt)
    `)
    .run({ id, ...doc, uploadedAt });

  const row = getDb()
    .prepare("SELECT * FROM documents WHERE id = ?")
    .get(id) as DocumentRow;
  return rowToDocument(row);
}

export function getClaimDocuments(claimId: string): DocumentAttachment[] {
  const rows = getDb()
    .prepare("SELECT * FROM documents WHERE claimId = ? ORDER BY uploadedAt ASC")
    .all(claimId) as DocumentRow[];
  return rows.map(rowToDocument);
}

// ── Reviewers CRUD ────────────────────────────────────────────────────────────

export function getAllReviewers(): Reviewer[] {
  const rows = getDb()
    .prepare("SELECT * FROM reviewers")
    .all() as ReviewerRow[];
  return rows.map(rowToReviewer);
}

export function setReviewerAvailability(id: string, isAvailable: boolean): Reviewer {
  getDb()
    .prepare("UPDATE reviewers SET isAvailable = ? WHERE id = ?")
    .run(isAvailable ? 1 : 0, id);
  const row = getDb()
    .prepare("SELECT * FROM reviewers WHERE id = ?")
    .get(id) as ReviewerRow | undefined;
  if (!row) throw new Error(`Reviewer not found: ${id}`);
  return rowToReviewer(row);
}

export function getClaimsByReviewer(reviewerId: string): Claim[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM claims
       WHERE assignedTo = ? AND deletedAt IS NULL
       ORDER BY createdAt DESC`
    )
    .all(reviewerId) as ClaimRow[];
  return rows.map(rowToClaim);
}

export function createReviewer(
  reviewer: Omit<Reviewer, "id">
): Reviewer {
  const id = randomUUID();
  getDb()
    .prepare(`
      INSERT INTO reviewers (id, name, email, role, isAvailable)
      VALUES (@id, @name, @email, @role, @isAvailable)
    `)
    .run({
      id,
      name: reviewer.name,
      email: reviewer.email,
      role: reviewer.role,
      isAvailable: reviewer.isAvailable ? 1 : 0,
    });

  const row = getDb()
    .prepare("SELECT * FROM reviewers WHERE id = ?")
    .get(id) as ReviewerRow;
  return rowToReviewer(row);
}
