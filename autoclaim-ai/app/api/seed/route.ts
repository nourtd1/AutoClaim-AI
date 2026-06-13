import { NextRequest, NextResponse } from "next/server";
import { initDb, getDb, createClaim, addStageEvent, createReviewer } from "@/lib/db";

// POST /api/seed?secret=SEED_SECRET
// Idempotent — checks if data already exists before inserting.

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDb();
  const db = getDb();

  // Check if already seeded
  const countR = await db.execute({ sql: "SELECT COUNT(*) as cnt FROM reviewers", args: [] });
  const cnt = Number((countR.rows[0] as unknown as { cnt: number }).cnt);
  if (cnt > 0) {
    return NextResponse.json({ message: "Already seeded", reviewers: cnt });
  }

  const alice  = await createReviewer({ name: "Alice Martin",  email: "alice.martin@autoclaim.io",  role: "Senior Adjuster",    isAvailable: true });
  const bob    = await createReviewer({ name: "Bob Diallo",    email: "bob.diallo@autoclaim.io",    role: "Claims Investigator", isAvailable: true });
  const fatima = await createReviewer({ name: "Fatima Ndiaye", email: "fatima.ndiaye@autoclaim.io", role: "Compliance Officer",  isAvailable: true });

  const approved = await createClaim({
    policyNumber:"POL-2024-001", claimantName:"Marie Dupont", claimantEmail:"marie.dupont@email.com",
    claimType:"PROPERTY_DAMAGE", incidentDate:"2024-03-10", claimAmount:850, currency:"EUR",
    description:"Bris de vitre suite à une tempête. Photos et devis fournis. Dommages mineurs.",
    status:"APPROVED", priority:"LOW", stage:"RESOLUTION", source:"FORM",
    documents:[
      {id:"doc-001",name:"photos_degats.pdf",type:"application/pdf",status:"PRESENT",url:"/uploads/doc-001.pdf",uploadedAt:"2024-03-11T08:00:00.000Z"},
      {id:"doc-002",name:"devis_reparation.pdf",type:"application/pdf",status:"PRESENT",url:"/uploads/doc-002.pdf",uploadedAt:"2024-03-11T08:05:00.000Z"},
    ],
    extractedData:{confidence:0.97,policyNumber:"POL-2024-001",claimantName:"Marie Dupont",incidentDate:"2024-03-10",claimAmount:850,claimType:"PROPERTY_DAMAGE",documentList:["photos_degats.pdf","devis_reparation.pdf"],rawText:"Déclaration sinistre – bris de vitre – 850 EUR",missingFields:[]},
    validationResult:{isValid:true,policyExists:true,documentsComplete:true,amountWithinLimit:true,errors:[],warnings:[],riskScore:8},
    reviewNotes:"Dossier complet. Montant validé automatiquement.", assignedTo:alice.id, resolvedAt:"2024-03-13T14:22:00.000Z",
  });
  await addStageEvent({claimId:approved.id,stage:"INTAKE",     status:"SUBMITTED", actor:"ROBOT",notes:"Réception formulaire en ligne"});
  await addStageEvent({claimId:approved.id,stage:"EXTRACTION", status:"EXTRACTING",actor:"AGENT",notes:"Extraction IA — confiance 97%"});
  await addStageEvent({claimId:approved.id,stage:"VALIDATION", status:"VALIDATING",actor:"AGENT",notes:"Politique vérifiée, documents complets"});
  await addStageEvent({claimId:approved.id,stage:"RESOLUTION", status:"APPROVED",  actor:"ROBOT",notes:"Approbation automatique — risque faible (8/100)"});

  const rejected = await createClaim({
    policyNumber:"POL-2024-002", claimantName:"Jean-Paul Moreau", claimantEmail:"jp.moreau@email.com",
    claimType:"MEDICAL", incidentDate:"2024-04-05", claimAmount:3200, currency:"EUR",
    description:"Hospitalisation d'urgence. Compte-rendu hospitalier et factures médicales manquants.",
    status:"REJECTED", priority:"MEDIUM", stage:"RESOLUTION", source:"EMAIL",
    documents:[
      {id:"doc-003",name:"formulaire_sinistre.pdf",type:"application/pdf",status:"PRESENT",url:"/uploads/doc-003.pdf",uploadedAt:"2024-04-06T10:00:00.000Z"},
      {id:"doc-004",name:"compte_rendu_hospitalier.pdf",type:"application/pdf",status:"MISSING",url:null,uploadedAt:"2024-04-06T10:00:00.000Z"},
    ],
    extractedData:{confidence:0.61,policyNumber:"POL-2024-002",claimantName:"Jean-Paul Moreau",incidentDate:"2024-04-05",claimAmount:3200,claimType:"MEDICAL",documentList:["formulaire_sinistre.pdf"],rawText:"Hospitalisation urgence 3200 EUR",missingFields:["compte_rendu_hospitalier","factures_medicales"]},
    validationResult:{isValid:false,policyExists:true,documentsComplete:false,amountWithinLimit:true,errors:["Compte-rendu hospitalier manquant","Factures médicales manquantes"],warnings:["Confiance extraction faible (61%)"],riskScore:45},
    reviewNotes:"Rejeté : documents obligatoires non fournis après relance.", assignedTo:alice.id, resolvedAt:"2024-04-15T09:00:00.000Z",
  });
  await addStageEvent({claimId:rejected.id,stage:"INTAKE",       status:"SUBMITTED",    actor:"ROBOT",notes:"Email reçu"});
  await addStageEvent({claimId:rejected.id,stage:"EXTRACTION",   status:"EXTRACTING",   actor:"AGENT",notes:"Documents partiels détectés — confiance 61%"});
  await addStageEvent({claimId:rejected.id,stage:"VALIDATION",   status:"VALIDATING",   actor:"AGENT",notes:"Validation échouée — pièces manquantes"});
  await addStageEvent({claimId:rejected.id,stage:"HUMAN_REVIEW", status:"PENDING_REVIEW",actor:"HUMAN",notes:"Relance envoyée au claimant"});
  await addStageEvent({claimId:rejected.id,stage:"RESOLUTION",   status:"REJECTED",     actor:"HUMAN",notes:"Rejet définitif après 10 jours sans réponse"});

  const pending = await createClaim({
    policyNumber:"POL-2024-003", claimantName:"Sophie Leclerc", claimantEmail:"s.leclerc@email.com",
    claimType:"ACCIDENT", incidentDate:"2024-05-20", claimAmount:18500, currency:"EUR",
    description:"Accident de la route — véhicule totalement détruit. Tiers impliqué. Tous documents fournis.",
    status:"PENDING_REVIEW", priority:"HIGH", stage:"HUMAN_REVIEW", source:"PDF",
    documents:[
      {id:"doc-006",name:"constat_amiable.pdf",type:"application/pdf",status:"PRESENT",url:"/uploads/doc-006.pdf",uploadedAt:"2024-05-21T09:00:00.000Z"},
      {id:"doc-007",name:"rapport_expertise.pdf",type:"application/pdf",status:"PRESENT",url:"/uploads/doc-007.pdf",uploadedAt:"2024-05-21T09:10:00.000Z"},
      {id:"doc-008",name:"photos_accident.pdf",type:"application/pdf",status:"PRESENT",url:"/uploads/doc-008.pdf",uploadedAt:"2024-05-21T09:15:00.000Z"},
    ],
    extractedData:{confidence:0.88,policyNumber:"POL-2024-003",claimantName:"Sophie Leclerc",incidentDate:"2024-05-20",claimAmount:18500,claimType:"ACCIDENT",documentList:["constat_amiable.pdf","rapport_expertise.pdf","photos_accident.pdf"],rawText:"Sinistre automobile – collision frontale – perte totale 18 500 EUR",missingFields:[]},
    validationResult:{isValid:true,policyExists:true,documentsComplete:true,amountWithinLimit:false,errors:[],warnings:["Montant supérieur au seuil automatique — revue humaine requise"],riskScore:52},
    reviewNotes:null, assignedTo:bob.id, resolvedAt:null,
  });
  await addStageEvent({claimId:pending.id,stage:"INTAKE",      status:"SUBMITTED",    actor:"ROBOT",notes:"PDF reçu via portail"});
  await addStageEvent({claimId:pending.id,stage:"EXTRACTION",  status:"EXTRACTING",   actor:"AGENT",notes:"Extraction réussie — confiance 88%"});
  await addStageEvent({claimId:pending.id,stage:"VALIDATION",  status:"VALIDATING",   actor:"AGENT",notes:"Montant 18 500€ dépasse le seuil automatique (15 000€)"});
  await addStageEvent({claimId:pending.id,stage:"HUMAN_REVIEW",status:"PENDING_REVIEW",actor:"ROBOT",notes:"Escalade automatique → Bob Diallo (Claims Investigator)"});

  const escalated = await createClaim({
    policyNumber:"POL-2024-004", claimantName:"Carlos Mendes", claimantEmail:"c.mendes@email.com",
    claimType:"THEFT", incidentDate:"2024-06-01", claimAmount:42000, currency:"EUR",
    description:"Vol de véhicule de luxe. Troisième sinistre vol sur 18 mois. Dépôt de plainte invalide.",
    status:"ESCALATED", priority:"CRITICAL", stage:"EXCEPTION_ROUTING", source:"FORM",
    documents:[
      {id:"doc-009",name:"declaration_vol.pdf",type:"application/pdf",status:"PRESENT",url:"/uploads/doc-009.pdf",uploadedAt:"2024-06-02T11:00:00.000Z"},
      {id:"doc-010",name:"depot_plainte.pdf",type:"application/pdf",status:"INVALID",url:"/uploads/doc-010.pdf",uploadedAt:"2024-06-02T11:05:00.000Z"},
    ],
    extractedData:{confidence:0.79,policyNumber:"POL-2024-004",claimantName:"Carlos Mendes",incidentDate:"2024-06-01",claimAmount:42000,claimType:"THEFT",documentList:["declaration_vol.pdf","depot_plainte.pdf"],rawText:"Vol véhicule de luxe 42 000 EUR",missingFields:[]},
    validationResult:{isValid:false,policyExists:true,documentsComplete:false,amountWithinLimit:false,errors:["Dépôt de plainte invalide ou falsifié"],warnings:["3ème sinistre vol en 18 mois — pattern suspect","Montant élevé (42 000 EUR)"],riskScore:91},
    reviewNotes:"Fraude potentielle détectée par l'IA. Escalade vers Compliance.", assignedTo:fatima.id, resolvedAt:null,
  });
  await addStageEvent({claimId:escalated.id,stage:"INTAKE",            status:"SUBMITTED", actor:"ROBOT",notes:"Formulaire soumis en ligne"});
  await addStageEvent({claimId:escalated.id,stage:"EXTRACTION",        status:"EXTRACTING",actor:"AGENT",notes:"Extraction OK — documents partiels"});
  await addStageEvent({claimId:escalated.id,stage:"VALIDATION",        status:"VALIDATING",actor:"AGENT",notes:"Score de risque : 91/100 — seuil critique dépassé"});
  await addStageEvent({claimId:escalated.id,stage:"EXCEPTION_ROUTING", status:"ESCALATED", actor:"AGENT",notes:"Pattern fraude détecté → escalade Compliance (Fatima Ndiaye)"});

  const submitted = await createClaim({
    policyNumber:"POL-2024-005", claimantName:"Thomas Bernard", claimantEmail:"t.bernard@email.com",
    claimType:"PROPERTY_DAMAGE", incidentDate:"2024-06-12", claimAmount:1200, currency:"EUR",
    description:"Annulation voyage — maladie soudaine attestée par certificat médical. En attente de traitement par l'IA.",
    status:"SUBMITTED", priority:"LOW", stage:"INTAKE", source:"FORM",
    documents:[{id:"doc-013",name:"certificat_medical.pdf",type:"application/pdf",status:"PRESENT",url:"/uploads/doc-013.pdf",uploadedAt:"2024-06-12T18:30:00.000Z"}],
    extractedData:null, validationResult:null, reviewNotes:null, assignedTo:null, resolvedAt:null,
  });
  await addStageEvent({claimId:submitted.id,stage:"INTAKE",status:"SUBMITTED",actor:"ROBOT",notes:"Formulaire reçu — en attente de traitement IA"});

  return NextResponse.json({
    message: "Seeded successfully",
    data: {
      reviewers: [alice.id, bob.id, fatima.id],
      claims: [approved.id, rejected.id, pending.id, escalated.id, submitted.id],
    },
  });
}
