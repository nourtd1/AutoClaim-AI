import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { initDb, createClaim, addDocument, addStageEvent, getDb } from "@/lib/db";


const MAX_FILE_SIZE  = 10 * 1024 * 1024;
const DESCRIPTION_MAX = 2000;

interface EmailHeaders { from:string|null; subject:string|null; date:string|null; policyNumber:string|null; body:string; }

function parseEmailFile(text: string): EmailHeaders {
  const lines = text.split(/\r?\n/);
  const h: EmailHeaders = { from:null, subject:null, date:null, policyNumber:null, body:"" };
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") { bodyStart = i + 1; break; }
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (!m) { bodyStart = i; break; }
    switch ((m[1]??"").trim().toLowerCase()) {
      case "from":          h.from          = (m[2]??"").trim(); break;
      case "subject":       h.subject       = (m[2]??"").trim(); break;
      case "date":          h.date          = (m[2]??"").trim(); break;
      case "policy-number": h.policyNumber  = (m[2]??"").trim(); break;
    }
  }
  h.body = lines.slice(bodyStart).join("\n").trim();
  return h;
}

function guessClaimantName(t:string)  { return t.match(/claimant[:\s]+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i)?.[1] ?? "Unknown Claimant"; }
function guessClaimantEmail(t:string, from:string|null) {
  if (from) { const m = from.match(/[\w.+-]+@[\w.-]+\.\w+/); if (m) return m[0]; }
  return t.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] ?? "unknown@unknown.com";
}
function guessClaimType(t:string) {
  const l = t.toLowerCase();
  if (l.includes("accident")||l.includes("collision")) return "ACCIDENT";
  if (l.includes("theft")||l.includes("stolen"))       return "THEFT";
  if (l.includes("medical")||l.includes("hospital"))   return "MEDICAL";
  if (l.includes("liability")||l.includes("lawsuit"))  return "LIABILITY";
  return "PROPERTY_DAMAGE";
}
function guessAmount(t:string) { const m = t.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/); return m?.[1] ? parseFloat(m[1].replace(/,/g,"")) : 0; }
function guessIncidentDate(t:string, d:string|null) {
  if (d) { const dt = new Date(d); if (!isNaN(dt.getTime())) return dt.toISOString().split("T")[0] as string; }
  const m = t.match(/(\d{4}-\d{2}-\d{2})/); if (m?.[1]) return m[1];
  return new Date().toISOString().split("T")[0] as string;
}

export async function POST(req: NextRequest) {
  await initDb();
  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ data:null, error:"Invalid multipart/form-data" }, { status:400 }); }

  const file              = formData.get("file") as File|null;
  const source            = formData.get("source") as string|null;
  const policyNumberField = formData.get("policyNumber") as string|null;

  if (!file)                                   return NextResponse.json({ data:null, error:"Missing field: file" },            { status:400 });
  if (source !== "PDF" && source !== "EMAIL")  return NextResponse.json({ data:null, error:"source must be PDF or EMAIL" },   { status:400 });
  if (file.size > MAX_FILE_SIZE)               return NextResponse.json({ data:null, error:"File exceeds 10 MB limit" },      { status:413 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let rawText = "";
  let emailHeaders: EmailHeaders|null = null;

  try {
    if (source === "PDF") {
      // Dynamic import avoids pdf-parse running its test-file reads at module load time (breaks Vercel)
      const pdfMod = await import("pdf-parse") as unknown as { default?: (buf: Buffer) => Promise<{ text: string }> } & ((buf: Buffer) => Promise<{ text: string }>);
      const pdfParse: (buf: Buffer) => Promise<{ text: string }> = pdfMod.default ?? pdfMod;
      const parsed = await pdfParse(buffer);
      rawText = parsed.text;
    } else {
      emailHeaders = parseEmailFile(buffer.toString("utf-8"));
      rawText = [emailHeaders.subject ? `Subject: ${emailHeaders.subject}` : null, emailHeaders.body].filter(Boolean).join("\n\n");
    }
  } catch (err) {
    console.error("[upload] text extraction error", err);
    return NextResponse.json({ data:null, error:"Failed to extract text from file" }, { status:422 });
  }

  if (!rawText.trim()) return NextResponse.json({ data:null, error:"File contains no extractable text" }, { status:422 });

  // On Vercel we skip writing to disk (read-only FS) — store content as data URL for demo
  const fileId  = randomUUID();
  let publicUrl = `/uploads/${fileId}${source === "PDF" ? ".pdf" : ".txt"}`;

  if (process.env.NEXT_RUNTIME !== "edge") {
    try {
      const { writeFile, mkdir } = await import("fs/promises");
      const path = await import("path");
      const dir = path.join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${fileId}${source === "PDF" ? ".pdf" : ".txt"}`), buffer);
    } catch {
      // Vercel read-only filesystem — skip, use placeholder URL
      publicUrl = `#uploaded-${fileId}`;
    }
  }

  const policyNumber = policyNumberField?.trim() || emailHeaders?.policyNumber || `POL-UPLOAD-${fileId.slice(0,8).toUpperCase()}`;
  const claimantName  = guessClaimantName(rawText);
  const claimantEmail = guessClaimantEmail(rawText, emailHeaders?.from ?? null);
  const claimType     = guessClaimType(rawText);
  const claimAmount   = guessAmount(rawText);
  const incidentDate  = guessIncidentDate(rawText, emailHeaders?.date ?? null);
  const description   = rawText.slice(0, DESCRIPTION_MAX);

  const claim = await createClaim({
    policyNumber, claimantName, claimantEmail, claimType, incidentDate,
    claimAmount: claimAmount > 0 ? claimAmount : 1, currency:"USD", description,
    status:"SUBMITTED", priority:"MEDIUM", stage:"INTAKE", source,
    documents:[], extractedData:null, validationResult:null, reviewNotes:null, assignedTo:null, resolvedAt:null,
  });

  await addStageEvent({ claimId:claim.id, stage:"INTAKE", status:"SUBMITTED", actor:"ROBOT", notes:`Claim received via ${source} upload: ${file.name}` });

  const doc = await addDocument({
    claimId: claim.id, filename: file.name,
    fileType: file.type || (source === "PDF" ? "application/pdf" : "text/plain"),
    fileSize: file.size, status: "PRESENT",
  });

  const claimDoc = { id:doc.id, name:file.name, type:doc.fileType, status:"PRESENT" as const, url:publicUrl, uploadedAt:doc.uploadedAt };
  const db = getDb();
  const rowR = await db.execute({ sql:"SELECT documents FROM claims WHERE id=?", args:[claim.id] });
  const existing = JSON.parse((rowR.rows[0] as unknown as {documents:string}).documents) as typeof claimDoc[];
  await db.execute({ sql:"UPDATE claims SET documents=?, updatedAt=? WHERE id=?", args:[JSON.stringify([...existing, claimDoc]), new Date().toISOString(), claim.id] });

  // Derive base URL from the incoming request so this works on Vercel, localhost, and any custom domain.
  const reqUrl = new URL(req.url);
  const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
  fetch(`${baseUrl}/api/orchestrate`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ claimId:claim.id }) })
    .catch(err => console.error("[upload] orchestrate fetch error", err));

  return NextResponse.json({ data:{ claim, document:doc, message:"Claim created and processing started" }, error:null }, { status:201 });
}
