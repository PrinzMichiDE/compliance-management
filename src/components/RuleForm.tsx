'use client';

import React, { useState, useEffect } from 'react';
import { Rule } from '@/types/rule';

interface RuleFormData {
  ruleId: string;
  name: string;
  description: string;
  category?: string;
  status: 'Entwurf' | 'Aktiv' | 'Inaktiv' | 'Archiviert';
  priority?: 'Hoch' | 'Mittel' | 'Niedrig';
  targetAudience: string[]; // Wird als Komma-getrennter String im Input bearbeitet
  linkedDocuments: string[]; // dto.
  tags: string[]; // dto.
  validFrom?: string; // YYYY-MM-DD Format für das Input-Feld
  validTo?: string;   // YYYY-MM-DD Format für das Input-Feld
  // Felder, die nicht im Formular sind oder speziell behandelt werden: _id, version, createdBy, etc.
}

interface RuleFormProps {
  initialData?: Partial<Rule>;
  onSubmit: (data: Partial<Rule>) => Promise<void>;
  isSubmitting?: boolean;
  submitButtonText?: string;
  onCancel?: () => void;
}

const RuleForm: React.FC<RuleFormProps> = ({ 
  initialData = {},
  onSubmit,
  isSubmitting = false,
  submitButtonText = 'Speichern',
  onCancel 
}) => {
  // Helper, um Date-Objekt oder ISO-String-Datumsteil in YYYY-MM-DD umzuwandeln oder ''
  const formatDateForInput = (date?: Date | string): string => {
    if (!date) return '';
    try {
      return new Date(date).toISOString().split('T')[0];
    } catch (error) {
      return ''; // Fallback für ungültige Daten
    }
  };

  const [formData, setFormData] = useState<RuleFormData>(() => ({
    ruleId: initialData.ruleId || '',
    name: initialData.name || '',
    description: initialData.description || '',
    category: initialData.category || '',
    status: initialData.status || 'Entwurf',
    priority: initialData.priority || 'Mittel',
    targetAudience: initialData.targetAudience || [],
    linkedDocuments: initialData.linkedDocuments || [],
    tags: initialData.tags || [],
    validFrom: formatDateForInput(initialData.validFrom),
    validTo: formatDateForInput(initialData.validTo),
  }));

  useEffect(() => {
    setFormData({
      ruleId: initialData.ruleId || '',
      name: initialData.name || '',
      description: initialData.description || '',
      category: initialData.category || '',
      status: initialData.status || 'Entwurf',
      priority: initialData.priority || 'Mittel',
      targetAudience: initialData.targetAudience || [],
      linkedDocuments: initialData.linkedDocuments || [],
      tags: initialData.tags || [],
      validFrom: formatDateForInput(initialData.validFrom),
      validTo: formatDateForInput(initialData.validTo),
    });
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleArrayChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof Pick<RuleFormData, 'targetAudience' | 'linkedDocuments' | 'tags'>) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, [fieldName]: value.split(',').map(item => item.trim()).filter(item => item) }));
  };
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.ruleId || !formData.name || !formData.description || !formData.status) {
      alert('Bitte füllen Sie alle Pflichtfelder aus: Regel-ID, Name, Beschreibung, Status.');
      return;
    }

    // Konvertiere Daten für die API, insbesondere Daten
    const dataToSubmit: Partial<Rule> = {
      ...formData,
      validFrom: formData.validFrom ? new Date(formData.validFrom) : undefined,
      validTo: formData.validTo ? new Date(formData.validTo) : undefined,
      // Stellen Sie sicher, dass andere Array-Felder korrekt als Arrays übergeben werden
      targetAudience: formData.targetAudience || [],
      linkedDocuments: formData.linkedDocuments || [],
      tags: formData.tags || [],
    };

    await onSubmit(dataToSubmit);
  };

  const inputClass = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="ruleId" className={labelClass}>Regel-ID (Benutzerdefiniert) <span className="text-red-500">*</span></label>
          <input type="text" name="ruleId" id="ruleId" value={formData.ruleId} onChange={handleChange} className={inputClass} required />
        </div>
        <div>
          <label htmlFor="name" className={labelClass}>Name der Regel <span className="text-red-500">*</span></label>
          <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className={inputClass} required />
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>Beschreibung <span className="text-red-500">*</span></label>
        <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={4} className={inputClass} required />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="status" className={labelClass}>Status <span className="text-red-500">*</span></label>
          <select name="status" id="status" value={formData.status} onChange={handleChange} className={inputClass} required>
            <option value="Entwurf">Entwurf</option>
            <option value="Aktiv">Aktiv</option>
            <option value="Inaktiv">Inaktiv</option>
            <option value="Archiviert">Archiviert</option>
          </select>
        </div>
        <div>
          <label htmlFor="category" className={labelClass}>Kategorie</label>
          <input type="text" name="category" id="category" value={formData.category || ''} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="priority" className={labelClass}>Priorität</label>
          <select name="priority" id="priority" value={formData.priority || 'Mittel'} onChange={handleChange} className={inputClass}>
            <option value="Hoch">Hoch</option>
            <option value="Mittel">Mittel</option>
            <option value="Niedrig">Niedrig</option>
          </select>
        </div>
        <div>
          <label htmlFor="tags" className={labelClass}>Tags (kommagetrennt)</label>
          <input type="text" name="tags" id="tags" value={formData.tags.join(', ')} onChange={(e) => handleArrayChange(e, 'tags')} className={inputClass} />
        </div>
      </div>
      
      <div>
        <label htmlFor="targetAudience" className={labelClass}>Zielgruppe (kommagetrennt)</label>
        <input type="text" name="targetAudience" id="targetAudience" value={formData.targetAudience.join(', ')} onChange={(e) => handleArrayChange(e, 'targetAudience')} className={inputClass} />
      </div>

      <div>
        <label htmlFor="linkedDocuments" className={labelClass}>Verknüpfte Dokumente (URLs, kommagetrennt)</label>
        <input type="text" name="linkedDocuments" id="linkedDocuments" value={formData.linkedDocuments.join(', ')} onChange={(e) => handleArrayChange(e, 'linkedDocuments')} className={inputClass} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="validFrom" className={labelClass}>Gültig von</label>
          <input type="date" name="validFrom" id="validFrom" value={formData.validFrom || ''} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label htmlFor="validTo" className={labelClass}>Gültig bis</label>
          <input type="date" name="validTo" id="validTo" value={formData.validTo || ''} onChange={handleChange} className={inputClass} />
        </div>
      </div>
      
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
        <p><strong>Hinweis:</strong> Felder wie Version, Ersteller, Erstellungsdatum, etc. werden automatisch vom System verwaltet.</p>
      </div>

      <div className="flex justify-end space-x-3">
        {onCancel && (
          <button 
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={isSubmitting}
          >
            Abbrechen
          </button>
        )}
        <button 
          type="submit"
          className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Wird gespeichert...' : submitButtonText}
        </button>
      </div>
    </form>
  );
};

export default RuleForm; 