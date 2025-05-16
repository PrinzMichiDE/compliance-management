export enum RiskProbability {
  LOW = 'niedrig',
  MEDIUM = 'mittel',
  HIGH = 'hoch',
}

export enum RiskImpact {
  LOW = 'niedrig',
  MEDIUM = 'mittel',
  HIGH = 'hoch',
}

export enum RiskStatus {
  OPEN = 'Offen',
  IN_PROGRESS = 'In Bearbeitung',
  CLOSED = 'Geschlossen',
  ACCEPTED = 'Akzeptiert',
  MITIGATED = 'Gemindert',
}

export interface MitigationMeasure {
  id: string;
  description: string;
  status: 'Geplant' | 'In Umsetzung' | 'Umgesetzt' | 'Verworfen';
  responsible: string;
  dueDate?: string; // ISO date string
}

export interface MitigationMeasureFormData {
  id: string;
  description: string;
  status: 'Geplant' | 'In Umsetzung' | 'Umgesetzt' | 'Verworfen';
  responsible: string;
  dueDate?: string; 
}

export interface Risk {
  _id?: string; // MongoDB ObjectId
  riskId: string; // Eindeutige, menschenlesbare ID, z.B. RISK-001
  title: string;
  description: string;
  source: string; // z.B. "Manuelle Eingabe", "KI-Analyse: Dokument XY", "Workshop Z"
  identifiedDate: string; // ISO date string
  category?: string; // z.B. "Operationell", "Finanziell", "Compliance", "Strategisch"
  probability: RiskProbability;
  impact: RiskImpact;
  riskScore?: number; // Berechnet aus probability und impact
  status: RiskStatus;
  owner?: string; // Verantwortliche Person oder Rolle
  mitigationMeasures?: MitigationMeasure[];
  reviewDate?: string; // ISO date string für nächste Überprüfung
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
  // KI-spezifische Felder (optional, für spätere Erweiterung)
  aiSuggestedProbability?: RiskProbability;
  aiSuggestedImpact?: RiskImpact;
  aiAnalysisConfidence?: number; // 0-1
  linkedRuleIds?: string[]; // IDs von Compliance Rules, die dieses Risiko adressieren
  aiGeneratedDescription?: string;
  aiIdentified?: boolean; // War die Identifizierung KI-basiert?
  aiSuggestedMitigation?: string;

  // Zusätzliche KI-Felder für Nachverfolgung und Updates
  aiGenerated?: boolean; // Doppelt zu aiIdentified, konsolidieren oder spezifischer benennen, hier behalte ich es mal zur Verdeutlichung der Anforderung
  sourceDocumentId?: string; // ID des Quelldokuments
  lastAiUpdate?: Date; // Wann wurde dieses Risiko zuletzt von der KI aktualisiert/erstellt
  createdBy?: string; // User ID oder System ID
  lastModifiedBy?: string; // User ID oder System ID
}

export type RiskFormData = Omit<Risk, '_id' | 'createdAt' | 'updatedAt' | 'riskScore' | 'mitigationMeasures' | 'createdBy' | 'lastModifiedBy' | 'lastAiUpdate'> & {
  mitigationMeasures?: MitigationMeasureFormData[];
  // Datumsfelder explizit als String, da das Formular sie so erwartet
  identifiedDate: string; 
  reviewDate?: string;
  // aiIdentified und sourceDocumentId können im Formular relevant sein, wenn ein KI-Vorschlag bearbeitet wird
  // aiGenerated sollte hier nicht Teil des Formulars sein, sondern serverseitig gesetzt werden.
}; 