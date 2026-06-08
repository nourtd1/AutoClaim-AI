import { initDb, createClaim, addStageEvent, createReviewer } from "../lib/db";

// ── Bootstrap ─────────────────────────────────────────────────────────────────

initDb();
console.log("✓ Tables created");

// ── Reviewers ─────────────────────────────────────────────────────────────────

const alice = createReviewer({
  name: "Alice Martin",
  email: "alice.martin@autoclaim.io",
  role: "Senior Adjuster",
  isAvailable: true,
});

const bob = createReviewer({
  name: "Bob Diallo",
  email: "bob.diallo@autoclaim.io",
  role: "Claims Investigator",
  isAvailable: true,
});

const fatima = createReviewer({
  name: "Fatima Ndiaye",
  email: "fatima.ndiaye@autoclaim.io",
  role: "Compliance Officer",
  isAvailable: true,
});

console.log("✓ Reviewers seeded (Alice, Bob, Fatima)");

// ── Claims ────────────────────────────────────────────────────────────────────

// 1 — APPROVED (simple, faible montant)
const approved = createClaim({
  policyNumber: "POL-2024-001",
  claimantName: "Marie Dupont",
  claimantEmail: "marie.dupont@email.com",
  claimType: "PROPERTY_DAMAGE",
  incidentDate: "2024-03-10",
  claimAmount: 850,
  currency: "EUR",
  description: "Bris de vitre suite à une tempête. Dommages mineurs.",
  status: "APPROVED",
  priority: "LOW",
  stage: "RESOLUTION",
  source: "FORM",
  documents: [
    {
      id: "doc-001",
      name: "photos_degats.pdf",
      type: "application/pdf",
      status: "PRESENT",
      url: "/uploads/doc-001.pdf",
      uploadedAt: "2024-03-11T08:00:00.000Z",
    },
    {
      id: "doc-002",
      name: "devis_reparation.pdf",
      type: "application/pdf",
      status: "PRESENT",
      url: "/uploads/doc-002.pdf",
      uploadedAt: "2024-03-11T08:05:00.000Z",
    },
  ],
  extractedData: {
    confidence: 0.97,
    policyNumber: "POL-2024-001",
    claimantName: "Marie Dupont",
    incidentDate: "2024-03-10",
    claimAmount: 850,
    claimType: "PROPERTY_DAMAGE",
    documentList: ["photos_degats.pdf", "devis_reparation.pdf"],
    rawText: "Déclaration de sinistre – bris de vitre – montant 850 EUR",
    missingFields: [],
  },
  validationResult: {
    isValid: true,
    policyExists: true,
    documentsComplete: true,
    amountWithinLimit: true,
    errors: [],
    warnings: [],
    riskScore: 8,
  },
  reviewNotes: "Dossier complet. Montant validé automatiquement.",
  assignedTo: alice.id,
  resolvedAt: "2024-03-13T14:22:00.000Z",
});

addStageEvent({ claimId: approved.id, stage: "INTAKE", status: "SUBMITTED", actor: "ROBOT", notes: "Réception formulaire en ligne" });
addStageEvent({ claimId: approved.id, stage: "EXTRACTION", status: "EXTRACTING", actor: "AGENT", notes: "Extraction IA — confiance 97%" });
addStageEvent({ claimId: approved.id, stage: "VALIDATION", status: "VALIDATING", actor: "AGENT", notes: "Politique vérifiée, documents complets" });
addStageEvent({ claimId: approved.id, stage: "RESOLUTION", status: "APPROVED", actor: "ROBOT", notes: "Approbation automatique — risque faible" });

// 2 — REJECTED (documents manquants)
const rejected = createClaim({
  policyNumber: "POL-2024-002",
  claimantName: "Jean-Paul Moreau",
  claimantEmail: "jp.moreau@email.com",
  claimType: "MEDICAL",
  incidentDate: "2024-04-05",
  claimAmount: 3200,
  currency: "EUR",
  description: "Hospitalisation d'urgence. Documents médicaux non fournis.",
  status: "REJECTED",
  priority: "MEDIUM",
  stage: "RESOLUTION",
  source: "EMAIL",
  documents: [
    {
      id: "doc-003",
      name: "formulaire_sinistre.pdf",
      type: "application/pdf",
      status: "PRESENT",
      url: "/uploads/doc-003.pdf",
      uploadedAt: "2024-04-06T10:00:00.000Z",
    },
    {
      id: "doc-004",
      name: "compte_rendu_hospitalier.pdf",
      type: "application/pdf",
      status: "MISSING",
      url: null,
      uploadedAt: "2024-04-06T10:00:00.000Z",
    },
    {
      id: "doc-005",
      name: "factures_medicales.pdf",
      type: "application/pdf",
      status: "MISSING",
      url: null,
      uploadedAt: "2024-04-06T10:00:00.000Z",
    },
  ],
  extractedData: {
    confidence: 0.61,
    policyNumber: "POL-2024-002",
    claimantName: "Jean-Paul Moreau",
    incidentDate: "2024-04-05",
    claimAmount: 3200,
    claimType: "MEDICAL",
    documentList: ["formulaire_sinistre.pdf"],
    rawText: "Hospitalisation urgence 3200 EUR – documents manquants",
    missingFields: ["compte_rendu_hospitalier", "factures_medicales"],
  },
  validationResult: {
    isValid: false,
    policyExists: true,
    documentsComplete: false,
    amountWithinLimit: true,
    errors: ["Compte-rendu hospitalier manquant", "Factures médicales manquantes"],
    warnings: ["Confiance extraction faible (61%)"],
    riskScore: 45,
  },
  reviewNotes: "Dossier rejeté : documents obligatoires non fournis après relance.",
  assignedTo: alice.id,
  resolvedAt: "2024-04-15T09:00:00.000Z",
});

addStageEvent({ claimId: rejected.id, stage: "INTAKE", status: "SUBMITTED", actor: "ROBOT", notes: "Email reçu" });
addStageEvent({ claimId: rejected.id, stage: "EXTRACTION", status: "EXTRACTING", actor: "AGENT", notes: "Documents partiels détectés" });
addStageEvent({ claimId: rejected.id, stage: "VALIDATION", status: "VALIDATING", actor: "AGENT", notes: "Validation échouée — pièces manquantes" });
addStageEvent({ claimId: rejected.id, stage: "HUMAN_REVIEW", status: "PENDING_REVIEW", actor: "HUMAN", notes: "Relance envoyée au claimant" });
addStageEvent({ claimId: rejected.id, stage: "RESOLUTION", status: "REJECTED", actor: "HUMAN", notes: "Rejet définitif après délai de 10 jours" });

// 3 — PENDING_REVIEW (montant élevé, risque moyen)
const pendingReview = createClaim({
  policyNumber: "POL-2024-003",
  claimantName: "Sophie Leclerc",
  claimantEmail: "s.leclerc@email.com",
  claimType: "VEHICLE",
  incidentDate: "2024-05-20",
  claimAmount: 18500,
  currency: "EUR",
  description: "Accident de la route — véhicule totalement détruit. Tiers impliqué.",
  status: "PENDING_REVIEW",
  priority: "HIGH",
  stage: "HUMAN_REVIEW",
  source: "PDF",
  documents: [
    {
      id: "doc-006",
      name: "constat_amiable.pdf",
      type: "application/pdf",
      status: "PRESENT",
      url: "/uploads/doc-006.pdf",
      uploadedAt: "2024-05-21T09:00:00.000Z",
    },
    {
      id: "doc-007",
      name: "rapport_expertise.pdf",
      type: "application/pdf",
      status: "PRESENT",
      url: "/uploads/doc-007.pdf",
      uploadedAt: "2024-05-21T09:10:00.000Z",
    },
    {
      id: "doc-008",
      name: "photos_accident.pdf",
      type: "application/pdf",
      status: "PRESENT",
      url: "/uploads/doc-008.pdf",
      uploadedAt: "2024-05-21T09:15:00.000Z",
    },
  ],
  extractedData: {
    confidence: 0.88,
    policyNumber: "POL-2024-003",
    claimantName: "Sophie Leclerc",
    incidentDate: "2024-05-20",
    claimAmount: 18500,
    claimType: "VEHICLE",
    documentList: ["constat_amiable.pdf", "rapport_expertise.pdf", "photos_accident.pdf"],
    rawText: "Sinistre automobile – collision frontale – perte totale 18 500 EUR",
    missingFields: [],
  },
  validationResult: {
    isValid: true,
    policyExists: true,
    documentsComplete: true,
    amountWithinLimit: false,
    errors: [],
    warnings: ["Montant supérieur au seuil automatique (15 000 EUR) — revue humaine requise"],
    riskScore: 52,
  },
  reviewNotes: null,
  assignedTo: bob.id,
  resolvedAt: null,
});

addStageEvent({ claimId: pendingReview.id, stage: "INTAKE", status: "SUBMITTED", actor: "ROBOT", notes: "PDF reçu via portail" });
addStageEvent({ claimId: pendingReview.id, stage: "EXTRACTION", status: "EXTRACTING", actor: "AGENT", notes: "Extraction réussie — confiance 88%" });
addStageEvent({ claimId: pendingReview.id, stage: "VALIDATION", status: "VALIDATING", actor: "AGENT", notes: "Montant dépasse le seuil automatique" });
addStageEvent({ claimId: pendingReview.id, stage: "HUMAN_REVIEW", status: "PENDING_REVIEW", actor: "ROBOT", notes: "Escalade automatique vers Bob Diallo" });

// 4 — ESCALATED (fraude suspectée)
const escalated = createClaim({
  policyNumber: "POL-2024-004",
  claimantName: "Carlos Mendes",
  claimantEmail: "c.mendes@email.com",
  claimType: "THEFT",
  incidentDate: "2024-06-01",
  claimAmount: 42000,
  currency: "EUR",
  description: "Vol de véhicule de luxe. Troisième sinistre vol sur 18 mois.",
  status: "ESCALATED",
  priority: "CRITICAL",
  stage: "EXCEPTION_ROUTING",
  source: "FORM",
  documents: [
    {
      id: "doc-009",
      name: "declaration_vol.pdf",
      type: "application/pdf",
      status: "PRESENT",
      url: "/uploads/doc-009.pdf",
      uploadedAt: "2024-06-02T11:00:00.000Z",
    },
    {
      id: "doc-010",
      name: "depot_plainte.pdf",
      type: "application/pdf",
      status: "INVALID",
      url: "/uploads/doc-010.pdf",
      uploadedAt: "2024-06-02T11:05:00.000Z",
    },
  ],
  extractedData: {
    confidence: 0.79,
    policyNumber: "POL-2024-004",
    claimantName: "Carlos Mendes",
    incidentDate: "2024-06-01",
    claimAmount: 42000,
    claimType: "THEFT",
    documentList: ["declaration_vol.pdf", "depot_plainte.pdf"],
    rawText: "Vol véhicule de luxe 42 000 EUR – dépôt de plainte présent",
    missingFields: [],
  },
  validationResult: {
    isValid: false,
    policyExists: true,
    documentsComplete: false,
    amountWithinLimit: false,
    errors: ["Dépôt de plainte invalide ou falsifié"],
    warnings: [
      "3ème sinistre vol en 18 mois — pattern suspect",
      "Montant élevé (42 000 EUR)",
      "Document d'identité non vérifié",
    ],
    riskScore: 91,
  },
  reviewNotes: "Fraude potentielle détectée par l'IA. Escalade vers Compliance.",
  assignedTo: fatima.id,
  resolvedAt: null,
});

addStageEvent({ claimId: escalated.id, stage: "INTAKE", status: "SUBMITTED", actor: "ROBOT", notes: "Formulaire soumis en ligne" });
addStageEvent({ claimId: escalated.id, stage: "EXTRACTION", status: "EXTRACTING", actor: "AGENT", notes: "Extraction OK — documents partiels" });
addStageEvent({ claimId: escalated.id, stage: "VALIDATION", status: "VALIDATING", actor: "AGENT", notes: "Score de risque : 91/100" });
addStageEvent({ claimId: escalated.id, stage: "EXCEPTION_ROUTING", status: "ESCALATED", actor: "AGENT", notes: "Pattern fraude détecté — escalade Compliance" });

// 5 — VALIDATING (en cours)
const validating = createClaim({
  policyNumber: "POL-2024-005",
  claimantName: "Isabelle Fontaine",
  claimantEmail: "i.fontaine@email.com",
  claimType: "LIABILITY",
  incidentDate: "2024-06-10",
  claimAmount: 7500,
  currency: "EUR",
  description: "Responsabilité civile — dégâts causés chez un voisin lors de travaux.",
  status: "VALIDATING",
  priority: "MEDIUM",
  stage: "VALIDATION",
  source: "EMAIL",
  documents: [
    {
      id: "doc-011",
      name: "devis_voisin.pdf",
      type: "application/pdf",
      status: "PRESENT",
      url: "/uploads/doc-011.pdf",
      uploadedAt: "2024-06-11T14:00:00.000Z",
    },
    {
      id: "doc-012",
      name: "attestation_rc.pdf",
      type: "application/pdf",
      status: "PRESENT",
      url: "/uploads/doc-012.pdf",
      uploadedAt: "2024-06-11T14:05:00.000Z",
    },
  ],
  extractedData: {
    confidence: 0.93,
    policyNumber: "POL-2024-005",
    claimantName: "Isabelle Fontaine",
    incidentDate: "2024-06-10",
    claimAmount: 7500,
    claimType: "LIABILITY",
    documentList: ["devis_voisin.pdf", "attestation_rc.pdf"],
    rawText: "RC voisin – dégâts travaux 7 500 EUR – attestation RC fournie",
    missingFields: [],
  },
  validationResult: null,
  reviewNotes: null,
  assignedTo: null,
  resolvedAt: null,
});

addStageEvent({ claimId: validating.id, stage: "INTAKE", status: "SUBMITTED", actor: "ROBOT", notes: "Email parsing automatique" });
addStageEvent({ claimId: validating.id, stage: "EXTRACTION", status: "EXTRACTING", actor: "AGENT", notes: "Extraction complète — confiance 93%" });
addStageEvent({ claimId: validating.id, stage: "VALIDATION", status: "VALIDATING", actor: "AGENT", notes: "Validation en cours…" });

// 6 — SUBMITTED (nouveau)
const submitted = createClaim({
  policyNumber: "POL-2024-006",
  claimantName: "Thomas Bernard",
  claimantEmail: "t.bernard@email.com",
  claimType: "TRAVEL",
  incidentDate: "2024-06-12",
  claimAmount: 1200,
  currency: "EUR",
  description: "Annulation voyage — maladie soudaine attestée par certificat médical.",
  status: "SUBMITTED",
  priority: "LOW",
  stage: "INTAKE",
  source: "FORM",
  documents: [
    {
      id: "doc-013",
      name: "certificat_medical.pdf",
      type: "application/pdf",
      status: "PRESENT",
      url: "/uploads/doc-013.pdf",
      uploadedAt: "2024-06-12T18:30:00.000Z",
    },
  ],
  extractedData: null,
  validationResult: null,
  reviewNotes: null,
  assignedTo: null,
  resolvedAt: null,
});

addStageEvent({ claimId: submitted.id, stage: "INTAKE", status: "SUBMITTED", actor: "ROBOT", notes: "Formulaire reçu — en attente de traitement" });

// ── Summary ───────────────────────────────────────────────────────────────────

console.log("✓ Claims seeded:");
console.log(`  • ${approved.id}  → APPROVED   (${approved.claimantName})`);
console.log(`  • ${rejected.id}  → REJECTED   (${rejected.claimantName})`);
console.log(`  • ${pendingReview.id}  → PENDING_REVIEW (${pendingReview.claimantName})`);
console.log(`  • ${escalated.id}  → ESCALATED  (${escalated.claimantName})`);
console.log(`  • ${validating.id}  → VALIDATING (${validating.claimantName})`);
console.log(`  • ${submitted.id}  → SUBMITTED  (${submitted.claimantName})`);
console.log("✓ Seed complete");
