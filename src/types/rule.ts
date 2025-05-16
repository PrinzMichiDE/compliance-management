import { ObjectId } from 'mongodb';

export interface Rule {
  _id?: ObjectId; // Wird von MongoDB automatisch hinzugefügt
  ruleId: string; 
  name: string;
  description: string;
  category?: string;
  status: 'Entwurf' | 'Aktiv' | 'Inaktiv' | 'Archiviert';
  priority?: 'Hoch' | 'Mittel' | 'Niedrig';
  targetAudience?: string[];
  responsiblePersonIds?: ObjectId[]; // Referenzen zu User._id
  linkedDocuments?: string[];
  tags?: string[];
  version?: number;
  createdBy?: ObjectId | string; // Referenz zu User._id oder System-ID
  lastModifiedBy?: ObjectId | string; // Referenz zu User._id oder System-ID
  createdAt?: Date;
  updatedAt?: Date;
  validFrom?: Date;
  validTo?: Date;
  customFields?: Record<string, unknown>;
  embedding?: number[]; // Vektor für semantische Suche

  // KI-spezifische Felder für Nachverfolgung und Updates
  aiGenerated?: boolean;
  sourceDocumentId?: string; // ID des Quelldokuments
  lastAiUpdate?: Date; // Wann wurde diese Regel zuletzt von der KI aktualisiert/erstellt
} 