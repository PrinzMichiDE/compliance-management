'use client';

import { useState, useEffect } from 'react';
import { Risk, RiskProbability, RiskImpact, RiskStatus, MitigationMeasure, RiskFormData, MitigationMeasureFormData } from '@/types/risk';

interface RiskFormProps {
  initialData?: RiskFormData;
  onSubmit: (data: RiskFormData) => Promise<void>;
  isSubmitting: boolean;
  submitButtonText?: string;
  onCancel?: () => void;
  formError?: string | null;
}

const initialMitigationMeasureTemplate: MitigationMeasureFormData = {
  id: '',
  description: '',
  status: 'Geplant',
  responsible: '',
  dueDate: '',
};

export default function RiskForm({
  initialData,
  onSubmit,
  isSubmitting,
  submitButtonText = 'Speichern',
  onCancel,
  formError
}: RiskFormProps) {
  const [formData, setFormData] = useState<RiskFormData>({} as RiskFormData);

  useEffect(() => {
    // Initialize form data with initialData or defaults
    const defaults: RiskFormData = {
      riskId: initialData?.riskId || '',
      title: '',
      description: '',
      category: '',
      probability: RiskProbability.LOW,
      impact: RiskImpact.LOW,
      status: RiskStatus.OPEN,
      owner: '',
      source: 'Manuelle Eingabe',
      identifiedDate: new Date().toISOString().split('T')[0],
      reviewDate: '',
      mitigationMeasures: [{ ...initialMitigationMeasureTemplate, id: crypto.randomUUID() }]
    };
    // Merge initialData with defaults. initialData takes precedence.
    // For mitigationMeasures, ensure it's an array and has at least one item.
    let mergedData: RiskFormData = {
         ...defaults, 
         ...(initialData || {}),
         mitigationMeasures: initialData?.mitigationMeasures && initialData.mitigationMeasures.length > 0 
                           ? initialData.mitigationMeasures.map(m => ({...initialMitigationMeasureTemplate, ...m, id: m.id || crypto.randomUUID()}))
                           : [{ ...initialMitigationMeasureTemplate, id: crypto.randomUUID() }]
    };
    
    // Format dates for input[type="date"]
    if (mergedData.identifiedDate) {
        mergedData.identifiedDate = new Date(mergedData.identifiedDate).toISOString().split('T')[0];
    }
    if (mergedData.reviewDate) {
        mergedData.reviewDate = new Date(mergedData.reviewDate).toISOString().split('T')[0];
    }
    mergedData.mitigationMeasures = mergedData.mitigationMeasures?.map(m => ({
        ...m,
        dueDate: m.dueDate ? new Date(m.dueDate).toISOString().split('T')[0] : ''
    }));

    setFormData(mergedData);
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMitigationChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updatedMeasures = formData.mitigationMeasures ? [...formData.mitigationMeasures] : [];
    // @ts-ignore
    updatedMeasures[index][name] = value;
    setFormData(prev => ({ ...prev, mitigationMeasures: updatedMeasures as MitigationMeasureFormData[] }));
  };

  const addMitigationMeasure = () => {
    setFormData(prev => ({
      ...prev,
      mitigationMeasures: [
        ...(prev.mitigationMeasures || []),
        { ...initialMitigationMeasureTemplate, id: crypto.randomUUID() }
      ]
    }));
  };

  const removeMitigationMeasure = (index: number) => {
    setFormData(prev => ({
      ...prev,
      mitigationMeasures: prev.mitigationMeasures?.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Basic validation (can be expanded)
    if (!formData.title || !formData.description) {
      // This kind of error should ideally be handled by the parent via formError prop
      alert('Titel und Beschreibung sind Pflichtfelder.'); 
      return;
    }
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">Fehler: </strong>
          <span className="block sm:inline">{formError}</span>
        </div>
      )}
      
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">Titel*</label>
        <input
          type="text"
          name="title"
          id="title"
          value={formData.title || ''}
          onChange={handleChange}
          required
          className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">Beschreibung*</label>
        <textarea
          name="description"
          id="description"
          rows={4}
          value={formData.description || ''}
          onChange={handleChange}
          required
          className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-slate-700">Kategorie</label>
            <input type="text" name="category" id="category" value={formData.category || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="owner" className="block text-sm font-medium text-slate-700">Verantwortlicher (Owner)</label>
            <input type="text" name="owner" id="owner" value={formData.owner || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
              <label htmlFor="probability" className="block text-sm font-medium text-slate-700">Wahrscheinlichkeit</label>
              <select name="probability" id="probability" value={formData.probability || RiskProbability.LOW} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  {Object.values(RiskProbability).map(val => <option key={val} value={val}>{val}</option>)}
              </select>
          </div>
          <div>
              <label htmlFor="impact" className="block text-sm font-medium text-slate-700">Auswirkung</label>
              <select name="impact" id="impact" value={formData.impact || RiskImpact.LOW} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  {Object.values(RiskImpact).map(val => <option key={val} value={val}>{val}</option>)}
              </select>
          </div>
           <div>
              <label htmlFor="status" className="block text-sm font-medium text-slate-700">Status</label>
              <select name="status" id="status" value={formData.status || RiskStatus.OPEN} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  {Object.values(RiskStatus).map(val => <option key={val} value={val}>{val}</option>)}
              </select>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
              <label htmlFor="identifiedDate" className="block text-sm font-medium text-slate-700">Identifiziert am</label>
              <input type="date" name="identifiedDate" id="identifiedDate" value={formData.identifiedDate || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
              <label htmlFor="reviewDate" className="block text-sm font-medium text-slate-700">Nächste Überprüfung am</label>
              <input type="date" name="reviewDate" id="reviewDate" value={formData.reviewDate || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
           <div>
              <label htmlFor="source" className="block text-sm font-medium text-slate-700">Quelle</label>
              <input type="text" name="source" id="source" value={formData.source || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
      </div>

      <fieldset className="border border-slate-300 p-4 rounded-md">
          <legend className="text-lg font-medium text-slate-700 px-2">Maßnahmen zur Risikominderung</legend>
          {formData.mitigationMeasures?.map((measure, index) => (
              <div key={measure.id || index} className="space-y-3 border-b border-slate-200 py-4 last:border-b-0">
                  <div className="flex justify-between items-center">
                      <h3 className="text-md font-semibold text-slate-600">Maßnahme {index + 1}</h3>
                      {formData.mitigationMeasures && formData.mitigationMeasures.length > 1 && (
                          <button type="button" onClick={() => removeMitigationMeasure(index)} className="text-red-500 hover:text-red-700 text-sm">Maßnahme entfernen</button>
                      )}
                  </div>
                  <div>
                      <label htmlFor={`mitigationDescription-${index}`} className="block text-xs font-medium text-slate-600">Beschreibung</label>
                      <textarea id={`mitigationDescription-${index}`} name="description" value={measure.description} onChange={(e) => handleMitigationChange(index, e)} rows={2} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                          <label htmlFor={`mitigationStatus-${index}`} className="block text-xs font-medium text-slate-600">Status</label>
                          <select id={`mitigationStatus-${index}`} name="status" value={measure.status} onChange={(e) => handleMitigationChange(index, e)} className="mt-1 block w-full px-3 py-2 border border-slate-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                              <option value="Geplant">Geplant</option>
                              <option value="In Umsetzung">In Umsetzung</option>
                              <option value="Umgesetzt">Umgesetzt</option>
                              <option value="Verworfen">Verworfen</option>
                          </select>
                      </div>
                      <div>
                          <label htmlFor={`mitigationResponsible-${index}`} className="block text-xs font-medium text-slate-600">Verantwortlich</label>
                          <input type="text" id={`mitigationResponsible-${index}`} name="responsible" value={measure.responsible} onChange={(e) => handleMitigationChange(index, e)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                      </div>
                      <div>
                          <label htmlFor={`mitigationDueDate-${index}`} className="block text-xs font-medium text-slate-600">Fälligkeitsdatum</label>
                          <input type="date" id={`mitigationDueDate-${index}`} name="dueDate" value={measure.dueDate || ''} onChange={(e) => handleMitigationChange(index, e)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                      </div>
                  </div>
              </div>
          ))}
          <button type="button" onClick={addMitigationMeasure} className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              + Weitere Maßnahme hinzufügen
          </button>
      </fieldset>

      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <button 
            type="button" 
            onClick={onCancel}
            className="px-6 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={isSubmitting}
          >
            Abbrechen
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Wird gespeichert...' : submitButtonText}
        </button>
      </div>
    </form>
  );
} 