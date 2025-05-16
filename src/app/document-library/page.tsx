'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { UserRole } from '@/types/enums';
import {
  ArrowPathIcon,
  DocumentArrowUpIcon,
  TrashIcon,
  DocumentMagnifyingGlassIcon,
  FolderOpenIcon,
  ArrowUturnLeftIcon,
  ArrowDownTrayIcon,
  AdjustmentsHorizontalIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowsUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShieldExclamationIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  ChevronUpIcon as SolidChevronUpIcon,
  ChevronDownIcon as SolidChevronDownIcon,
  ArrowsUpDownIcon as SolidArrowsUpDownIcon,
} from '@heroicons/react/24/solid';

interface DocumentDisplay {
  _id: string; // ID aus MongoDB
  name: string; // originalFilename
  size: number;
  lastModified: string; // ISO String von createdAt
  fileType: string;
  storageFilename: string; // Der eindeutige Name der Datei im Storage (doc.filename aus DB)
  embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed'; // Hinzugefügt
  status?: 'draft' | 'inReview' | 'approved' | 'rejected'; // Status hinzugefügt
  searchScore?: number; // Für semantische Suchergebnisse
}

// Typen für Filteroptionen
const documentStatuses = ['all', 'draft', 'inReview', 'approved', 'rejected'] as const;
type DocumentStatusFilter = typeof documentStatuses[number];

const fileTypeOptionsExample = ['all', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] as const;
type FileTypeFilterExample = typeof fileTypeOptionsExample[number];

// Sortierungs-States
type SortableField = 'name' | 'lastModified' | 'size' | 'status' | 'fileType'; // Angepasst an Frontend-Benennung/Daten

interface PaginatedApiResponse {
  documents: DocumentDisplay[];
  totalDocuments: number;
  currentPage: number;
  totalPages: number;
}

// Neue Typen für KI-Antworten (könnten auch in separate Typ-Dateien)
interface SuggestedRuleResponse {
  suggestedRule: Partial<any>; // Verwenden Sie hier den präzisen Rule-Typ, falls verfügbar und sinnvoll
}

interface SuggestedRiskResponse {
  suggestedRisk: Partial<any>; // Verwenden Sie hier den präzisen RiskFormData-Typ
}

export default function DocumentLibraryPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  // States für semantische Suche
  const [semanticSearchQuery, setSemanticSearchQuery] = useState('');
  const [semanticSearchResults, setSemanticSearchResults] = useState<DocumentDisplay[]>([]);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [semanticSearchError, setSemanticSearchError] = useState<string | null>(null);
  const [activeSearchMode, setActiveSearchMode] = useState<'filter' | 'semantic'>('filter');

  // Filter States
  const [filterStatus, setFilterStatus] = useState<DocumentStatusFilter>('all');
  const [filterFileType, setFilterFileType] = useState<FileTypeFilterExample>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [availableFileTypes, setAvailableFileTypes] = useState<string[]>(['all']);

  // Sortierungs-States
  const [sortBy, setSortBy] = useState<SortableField>('lastModified');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Paginierungs-States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Konfigurierbar, falls gewünscht
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // State für Batch-Aktionen
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [batchDeleteError, setBatchDeleteError] = useState<string | null>(null);
  const [batchDeleteSuccessMessage, setBatchDeleteSuccessMessage] = useState<string | null>(null);

  // Neue States für KI-Vorschläge
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  // Neue States für globale Analyse
  const [isGlobalAnalyzing, setIsGlobalAnalyzing] = useState(false);
  const [globalAnalysisMessage, setGlobalAnalysisMessage] = useState<string | null>(null);
  const [globalAnalysisError, setGlobalAnalysisError] = useState<string | null>(null);

  // Berechtigungsprüfung
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    // Beispiel: Nur bestimmte Rollen dürfen die Dokumentenbibliothek sehen/verwalten
    const allowedViewRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.COMPLIANCE_MANAGER_FULL,
      UserRole.COMPLIANCE_MANAGER_READ,
      UserRole.COMPLIANCE_MANAGER_WRITE
    ];
    if (session?.user?.roles && !session.user.roles.some(role => allowedViewRoles.includes(role))) {
      alert('Sie haben keine Berechtigung, auf die Dokumentenbibliothek zuzugreifen.');
      router.replace('/dashboard'); // Oder eine andere passende Seite
    }
  }, [authStatus, session, router]);

  const fetchDocuments = useCallback(async () => {
    if (activeSearchMode === 'semantic') {
      // Wenn im semantischen Suchmodus, nicht die Standarddokumente laden
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      // Filterparameter
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterFileType !== 'all') params.append('fileType', filterFileType);
      if (filterDateFrom) params.append('dateFrom', filterDateFrom);
      if (filterDateTo) params.append('dateTo', filterDateTo);

      // Sortierparameter
      let apiSortBy: string = sortBy;
      if (sortBy === 'name') apiSortBy = 'originalFilename';
      else if (sortBy === 'lastModified') apiSortBy = 'createdAt';
      params.append('sortBy', apiSortBy);
      params.append('sortOrder', sortOrder);

      // Paginierungsparameter
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const response = await fetch(`/api/documents?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Laden der Dokumente');
      }
      const result: PaginatedApiResponse = await response.json();
      let dataToDisplay = result.documents;
      
      // Dynamische Dateitypen (nur wenn keine Filter/Seite aktiv ist, um bei Paginierung nicht neu zu setzen)
      if (filterStatus === 'all' && filterFileType === 'all' && !filterDateFrom && !filterDateTo && currentPage === 1) {
        const uniqueFileTypes = Array.from(new Set(dataToDisplay.map(doc => doc.fileType)));
        setAvailableFileTypes(['all', ...uniqueFileTypes.sort()]);
      }

      // Client-seitige Namenssuche (optional, kann entfernt werden, wenn Paginierung + Server-Suche bevorzugt wird)
      if (searchTerm) {
        // Wichtig: Bei client-seitiger Suche nach serverseitiger Paginierung
        // wird nur die aktuelle Seite durchsucht. Für eine globale Suche müsste diese Logik angepasst werden
        // oder die Suche komplett serverseitig erfolgen.
        dataToDisplay = dataToDisplay.filter(doc => 
          doc.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      setDocuments(dataToDisplay);
      setTotalDocuments(result.totalDocuments);
      setTotalPages(result.totalPages);
      // setCurrentPage(result.currentPage); // Wird bereits vom State gesteuert, API bestätigt es nur

    } catch (e: any) {
      setError(e.message);
      setDocuments([]);
      setTotalDocuments(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterFileType, filterDateFrom, filterDateTo, searchTerm, sortBy, sortOrder, currentPage, itemsPerPage, activeSearchMode]);

  useEffect(() => {
    if (authStatus === 'authenticated' && activeSearchMode === 'filter') {
      fetchDocuments();
    }
    // Wenn activeSearchMode auf 'semantic' wechselt, soll fetchDocuments nicht automatisch ausgelöst werden.
    // Die semantische Suche hat ihren eigenen Lade-Workflow.
  }, [authStatus, fetchDocuments, activeSearchMode]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setUploadError(null);
      setUploadSuccessMessage(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setUploadError('Bitte wählen Sie zuerst eine Datei aus.');
      return;
    }
    // Rollenprüfung für Upload
    const allowedUploadRoles: UserRole[] = [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE];
    if (session?.user?.roles && !session.user.roles.some(role => allowedUploadRoles.includes(role))) {
      alert('Sie haben keine Berechtigung, Dokumente hochzuladen.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccessMessage(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Fehler beim Hochladen (HTTP ${response.status})`);
      }
      const result = await response.json();
      setUploadSuccessMessage(`Datei '${result.filename}' erfolgreich hochgeladen.`);
      setSelectedFile(null); // Reset file input
      if (document.getElementById('file-upload-library')) {
        (document.getElementById('file-upload-library') as HTMLInputElement).value = ''; // Clear file input display
      }
      fetchDocuments(); // Liste aktualisieren
      alert(`Datei '${result.filename}' erfolgreich hochgeladen.`);
    } catch (e: any) {
      setUploadError(e.message);
      alert(`Upload fehlgeschlagen: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string, documentName: string) => {
    // Rollenprüfung für Löschen
    const allowedDeleteRoles: UserRole[] = [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL];
     if (session?.user?.roles && !session.user.roles.some(role => allowedDeleteRoles.includes(role))) {
      alert('Sie haben keine Berechtigung, Dokumente zu löschen.');
      return;
    }

    if (!confirm(`Sind Sie sicher, dass Sie die Datei '${documentName}' löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/documents', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: documentId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Löschen des Dokuments');
      }
      alert(`Datei '${documentName}' erfolgreich gelöscht.`);
      fetchDocuments(); // Liste aktualisieren
    } catch (e: any) {
      setError(e.message);
      alert(`Löschen fehlgeschlagen: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeDocument = async (docId: string) => {
    // Zuerst das vollständige Dokument-Objekt aus dem State holen, um an den storageFilename zu kommen
    // (oder wir übergeben das ganze doc-Objekt an diese Funktion)
    // Fürs Erste gehen wir davon aus, dass wir den storageFilename noch nicht direkt im DocumentDisplay haben.
    // Wir müssten ihn also entweder im DocumentDisplay speichern oder eine zusätzliche Abfrage machen.
    
    // Vereinfachung: Wir nehmen an, der GET Endpunkt liefert uns auch den 'filename' (storage name)
    // TODO: GET /api/documents erweitern, um auch doc.filename (storage name) zurückzugeben oder doc hier anders fetchen.
    // Für den Moment simulieren wir, dass wir ihn hätten oder leiten anders ab.

    // Annahme: Die `documents` State-Variable enthält jetzt Objekte, die auch ein Feld `storageFilename` haben.
    // Dies muss im GET /api/documents und im DocumentDisplay Interface angepasst werden.
    // Für diesen Edit gehe ich davon aus, dass `doc.name` der `originalFilename` ist und wir den `storageFilename` brauchen.
    // Idealerweise würde fetchDocuments ein Objekt mit { _id, name (original), size, lastModified, fileType, storageFilename } liefern.

    // AKTUELLER WORKAROUND / TODO: Da wir den storageFilename (den unique UUID-Namen) nicht direkt im Frontend-Document-Objekt haben,
    // können wir ihn nicht einfach an den Analyse-Endpunkt weitergeben. Der Analyze-Endpunkt braucht den unique Filename.
    // Wir müssten den GET /api/documents Endpunkt anpassen, um diesen auch zu liefern.
    // Für den Moment kann handleAnalyzeDocument so nicht korrekt funktionieren ohne diese Info.
    // Ich kommentiere die kritische Zeile vorerst aus und wir müssen das beheben.
    
    const documentToAnalyze = documents.find(d => d._id === docId);
    if (!documentToAnalyze) {
        alert("Dokument nicht gefunden für Analyse.");
        return;
    }

    const filePathToAnalyze = `persistent_uploads/documents/${documentToAnalyze.storageFilename}`;
    router.push(`/document-analysis-viewer?filePath=${encodeURIComponent(filePathToAnalyze)}&fileType=${encodeURIComponent(documentToAnalyze.fileType)}&fileName=${encodeURIComponent(documentToAnalyze.name)}&documentId=${encodeURIComponent(documentToAnalyze._id)}`);
  };

  const handleResetFilters = () => {
    setFilterStatus('all');
    setFilterFileType('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchTerm('');
    setCurrentPage(1); // Paginierung beim Reset zurücksetzen
    // fetchDocuments wird automatisch durch den useEffect aufgerufen
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleSort = (field: SortableField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc'); // Standardmäßig aufsteigend, wenn neue Spalte gewählt wird
    }
  };

  const renderSortIcon = (field: SortableField) => {
    if (sortBy === field) {
      return sortOrder === 'asc' ? <SolidChevronUpIcon className="h-4 w-4 inline ml-1" /> : <SolidChevronDownIcon className="h-4 w-4 inline ml-1" />;
    }
    return <SolidArrowsUpDownIcon className="h-4 w-4 inline ml-1 text-slate-400 group-hover:text-slate-500" />;
  };

  const handleToggleSelectDocument = (documentId: string) => {
    setSelectedDocumentIds(prevSelectedIds => {
      if (prevSelectedIds.includes(documentId)) {
        return prevSelectedIds.filter(id => id !== documentId);
      }
      return [...prevSelectedIds, documentId];
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedDocumentIds.length === documents.length && documents.length > 0) {
      setSelectedDocumentIds([]); // Alle abwählen
    } else {
      setSelectedDocumentIds(documents.map(doc => doc._id)); // Alle aktuell angezeigten auswählen
    }
  };

  const handleBatchDelete = async () => {
    if (selectedDocumentIds.length === 0) {
      alert('Bitte wählen Sie mindestens ein Dokument zum Löschen aus.');
      return;
    }

    if (!confirm(`Sind Sie sicher, dass Sie die ausgewählten ${selectedDocumentIds.length} Dokument(e) löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }

    setIsBatchDeleting(true);
    setBatchDeleteError(null);
    setBatchDeleteSuccessMessage(null);

    try {
      const response = await fetch('/api/documents/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentIds: selectedDocumentIds }),
      });

      const resultData = await response.json();

      if (!response.ok) {
        throw new Error(resultData.error || `Fehler bei der Batch-Löschung (HTTP ${response.status})`);
      }

      const results = resultData.results as Array<{ documentId: string; originalFilename?: string; status: string; error?: string }>;
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status !== 'success').length;

      let message = `${successCount} Dokument(e) erfolgreich gelöscht.`;
      if (errorCount > 0) {
        message += ` ${errorCount} Dokument(e) konnten nicht gelöscht werden (Details siehe Konsole).`;
        console.error('Fehler beim Batch-Löschen:', results.filter(r => r.status !== 'success'));
        setBatchDeleteError(`${errorCount} Dokument(e) konnten nicht gelöscht werden.`);
      }
      setBatchDeleteSuccessMessage(message);
      alert(message); // Für sofortiges Feedback, kann durch Toasts ersetzt werden

      setSelectedDocumentIds([]); // Auswahl zurücksetzen
      fetchDocuments(); // Dokumentenliste neu laden

    } catch (e: any) {
      console.error('Client-Fehler beim Batch-Löschen:', e);
      setBatchDeleteError(e.message);
      alert(`Fehler: ${e.message}`);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleSemanticSearch = async () => {
    if (!semanticSearchQuery.trim()) {
      setSemanticSearchError('Bitte geben Sie einen Suchbegriff ein.');
      setSemanticSearchResults([]);
      // Bei leerer semantischer Suche zurück zum Filtermodus und normale Dokumente laden
      if (activeSearchMode === 'semantic') {
         setActiveSearchMode('filter');
         // fetchDocuments wird durch den useEffect oben getriggert, wenn activeSearchMode sich ändert.
      }
      return;
    }

    setIsSemanticSearching(true);
    setSemanticSearchError(null);
    setSemanticSearchResults([]); 
    setActiveSearchMode('semantic');
    // Bestehende Dokumentenliste und Paginierung zurücksetzen, da die Ansicht wechselt
    setDocuments([]);
    setCurrentPage(1);
    setTotalDocuments(0);
    setTotalPages(0);
    setSelectedDocumentIds([]); // Auswahl aufheben beim Wechseln des Suchmodus

    try {
      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: semanticSearchQuery, topK: 20 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler bei der semantischen Suche');
      }

      const result = await response.json();
      setSemanticSearchResults(result.documents || []);
      console.log('[Frontend] Semantic Search Results in State:', result.documents || []);
      if (!result.documents || result.documents.length === 0) {
          setSemanticSearchError('Keine Dokumente für Ihre semantische Anfrage gefunden.');
      }

    } catch (e: any) {
      setSemanticSearchError(e.message);
      setSemanticSearchResults([]);
    } finally {
      setIsSemanticSearching(false);
    }
  };

  // Neue Handler für KI-Vorschläge
  const handleSuggestRule = async (docId: string, docName: string) => {
    setIsSuggesting(true);
    setSuggestionError(null);
    try {
      const response = await fetch(`/api/ai/suggest-rules-from-document?documentId=${docId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Fehler beim Abrufen von Regelvorschlägen für ${docName}`);
      }
      const data: SuggestedRuleResponse = await response.json();
      if (data.suggestedRule) {
        const queryParams = new URLSearchParams();
        Object.entries(data.suggestedRule).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              queryParams.append(key, JSON.stringify(value)); // Arrays als JSON-String
            } else {
              queryParams.append(key, String(value));
            }
          }
        });
        router.push(`/rule-manager/new?${queryParams.toString()}`);
      } else {
        throw new Error('Keine Regelvorschläge von der API erhalten.');
      }
    } catch (e: any) {
      console.error('Fehler beim Vorschlagen von Regeln:', e);
      setSuggestionError(e.message || 'Ein Fehler ist aufgetreten.');
      alert(`Fehler beim Vorschlagen von Regeln: ${e.message}`);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSuggestRisk = async (docId: string, docName: string) => {
    setIsSuggesting(true);
    setSuggestionError(null);
    try {
      const response = await fetch(`/api/ai/suggest-risks-from-document?documentId=${docId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Fehler beim Abrufen von Risikovorschlägen für ${docName}`);
      }
      const data: SuggestedRiskResponse = await response.json();
      if (data.suggestedRisk) {
        const queryParams = new URLSearchParams();
        Object.entries(data.suggestedRisk).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
             if (Array.isArray(value)) {
              // Für Risiken werden Arrays (z.B. mitigationMeasures) aktuell nicht per Query-Param übergeben
              // Stattdessen könnte aiIdentified (string) verwendet werden.
              // queryParams.append(key, JSON.stringify(value));
            } else {
              queryParams.append(key, String(value));
            }
          }
        });
        // Spezifische Felder, die die KI liefern könnte, explizit hinzufügen
        if (data.suggestedRisk.aiIdentified !== undefined) queryParams.set('aiIdentified', String(data.suggestedRisk.aiIdentified));

        router.push(`/risk-manager/new?${queryParams.toString()}`);
      } else {
        throw new Error('Keine Risikovorschläge von der API erhalten.');
      }
    } catch (e: any) {
      console.error('Fehler beim Vorschlagen von Risiken:', e);
      setSuggestionError(e.message || 'Ein Fehler ist aufgetreten.');
      alert(`Fehler beim Vorschlagen von Risiken: ${e.message}`);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleGlobalAiAnalysis = async () => {
    if (!confirm('Möchten Sie wirklich eine KI-Analyse für alle relevanten Dokumente starten, um automatisch Regeln und Risiken zu erstellen? Dieser Vorgang kann einige Zeit dauern.')) {
      return;
    }
    setIsGlobalAnalyzing(true);
    setGlobalAnalysisMessage(null);
    setGlobalAnalysisError(null);

    try {
      const response = await fetch('/api/ai/batch-generate-suggestions', {
        method: 'POST',
        // Body könnte Filterkriterien enthalten, falls gewünscht
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Fehler bei der globalen KI-Analyse.');
      }
      setGlobalAnalysisMessage(`Analyse abgeschlossen: ${result.rulesCreated || 0} Regeln und ${result.risksCreated || 0} Risiken erstellt/aktualisiert. Fehler: ${result.errorsCount || 0}.`);
      alert(`Analyse abgeschlossen: ${result.rulesCreated || 0} Regeln und ${result.risksCreated || 0} Risiken erstellt/aktualisiert. Fehler: ${result.errorsCount || 0}.`);
      fetchDocuments(); // Liste aktualisieren, falls neue Elemente indirekt sichtbar werden
    } catch (e: any) {
      setGlobalAnalysisError(e.message);
      alert(`Fehler bei der globalen Analyse: ${e.message}`);
    } finally {
      setIsGlobalAnalyzing(false);
    }
  };

  // Bestimme, welche Dokumente angezeigt werden sollen
  const documentsToDisplay = activeSearchMode === 'semantic' ? semanticSearchResults : documents;
  const currentTotalDocuments = activeSearchMode === 'semantic' ? semanticSearchResults.length : totalDocuments;
  const currentTotalPages = activeSearchMode === 'semantic' ? Math.ceil(semanticSearchResults.length / itemsPerPage) : totalPages;
  // Im semantischen Modus wird die Paginierung clientseitig auf den topK Ergebnissen basieren oder serverseitig (noch nicht implementiert für search)
  // Fürs Erste zeigen wir alle semantischen Ergebnisse oder implementieren eine einfache clientseitige Paginierung für die semantischen Ergebnisse.
  // Hier vereinfacht: Paginierung gilt für Filter-Modus. Semantische Suche zeigt Top K.

  // Deaktiviere Filter/Sortierung/Paginierung, wenn im semantischen Suchmodus, um UI-Konflikte zu vermeiden
  const isSemanticModeActive = activeSearchMode === 'semantic';

  // Berechtigungen für KI-Aktionen (Beispiel)
  const canSuggestAiItems = session?.user?.roles?.some(role => 
    [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE].includes(role)
  );

  // Berechtigung für globale Analyse
  const canRunGlobalAnalysis = session?.user?.roles?.some(role => 
    [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL].includes(role)
  );

  if (authStatus === 'loading' || !session) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100">
        <div className="text-center">
          <ArrowPathIcon className="h-12 w-12 text-slate-500 animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold text-slate-700">Lade Dokumentenbibliothek...</p>
        </div>
      </div>
    );
  }

  // JSX für Filterbereich
  const filterSection = (
    <div className="mb-6 p-4 bg-white rounded-lg shadow border border-slate-200">
      <h3 className="text-lg font-medium text-slate-900 mb-3">Filteroptionen</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          <label htmlFor="filter-status" className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select 
            id="filter-status" 
            name="filter-status" 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value as DocumentStatusFilter)}
            className="block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
          >
            {documentStatuses.map(status => (
              <option key={status} value={status}>{status === 'all' ? 'Alle Status' : status.charAt(0).toUpperCase() + status.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* File Type Filter */}
        <div>
          <label htmlFor="filter-fileType" className="block text-sm font-medium text-slate-700 mb-1">Dateityp</label>
          <select 
            id="filter-fileType" 
            name="filter-fileType" 
            value={filterFileType} 
            onChange={(e) => setFilterFileType(e.target.value as FileTypeFilterExample)} 
            className="block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
          >
            {availableFileTypes.map(type => (
              <option key={type} value={type}>{type === 'all' ? 'Alle Dateitypen' : type}</option>
            ))}
          </select>
        </div>

        {/* Date From Filter */}
        <div>
          <label htmlFor="filter-dateFrom" className="block text-sm font-medium text-slate-700 mb-1">Hochgeladen ab</label>
          <input 
            type="date" 
            id="filter-dateFrom" 
            name="filter-dateFrom" 
            value={filterDateFrom} 
            onChange={(e) => setFilterDateFrom(e.target.value)} 
            className="block w-full pl-3 pr-2 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
          />
        </div>

        {/* Date To Filter */}
        <div>
          <label htmlFor="filter-dateTo" className="block text-sm font-medium text-slate-700 mb-1">Hochgeladen bis</label>
          <input 
            type="date" 
            id="filter-dateTo" 
            name="filter-dateTo" 
            value={filterDateTo} 
            onChange={(e) => setFilterDateTo(e.target.value)} 
            className="block w-full pl-3 pr-2 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button 
          onClick={handleResetFilters} 
          className="inline-flex items-center px-3 py-2 border border-slate-300 text-sm leading-4 font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <XMarkIcon className="h-4 w-4 mr-2" />
          Filter zurücksetzen
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center px-4 py-2 text-sm bg-white text-slate-700 font-semibold rounded-md border border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 mb-4"
          >
            <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
            Zurück zum Dashboard
          </Link>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-slate-800 flex items-center">
              <FolderOpenIcon className="h-8 w-8 mr-3 text-sky-600" />
              Dokumentenbibliothek
            </h1>
            <button 
              onClick={() => setShowFilters(!showFilters)} 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2" />
              {showFilters ? 'Filter ausblenden' : 'Filter anzeigen'}
            </button>
          </div>
          
          {/* Suchleiste für Namen - wird bei semantischer Suche ausgeblendet/deaktiviert */}
          {!isSemanticModeActive && (
            <div className="mb-4">
              <label htmlFor="search-document-name" className="sr-only">Dokumentnamen durchsuchen</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DocumentMagnifyingGlassIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
                <input
                  type="search"
                  name="search-document-name"
                  id="search-document-name"
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2"
                  placeholder="Dokumentnamen filtern (aktuelle Seite)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Semantische Suchleiste */}
          <div className="mb-6 p-4 bg-white rounded-lg shadow border border-sky-200">
            <h3 className="text-lg font-medium text-slate-900 mb-2">Semantische Suche</h3>
            <div className="flex items-center space-x-2">
              <input
                type="search"
                name="semantic-search-query"
                id="semantic-search-query"
                className="focus:ring-sky-500 focus:border-sky-500 block w-full sm:text-sm border-slate-300 rounded-md py-2 px-3 flex-grow"
                placeholder="Semantische Suchanfrage eingeben..."
                value={semanticSearchQuery}
                onChange={(e) => setSemanticSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSemanticSearch()}
              />
              <button
                onClick={handleSemanticSearch}
                disabled={isSemanticSearching || !semanticSearchQuery.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
              >
                {isSemanticSearching ? (
                  <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                ) : (
                  <DocumentMagnifyingGlassIcon className="h-4 w-4 mr-2" />
                )}
                {isSemanticSearching ? 'Suche...' : 'Suchen'}
              </button>
            </div>
            {semanticSearchError && (
              <p className="mt-2 text-sm text-red-600">{semanticSearchError}</p>
            )}
             <button
                onClick={() => {
                  setActiveSearchMode('filter');
                  setSemanticSearchQuery('');
                  setSemanticSearchResults([]);
                  setSemanticSearchError(null);
                  // fetchDocuments(); // Wird durch useEffect getriggert
                }}
                className="mt-2 text-sm text-sky-600 hover:text-sky-800 disabled:opacity-50"
                hidden={!isSemanticModeActive && semanticSearchResults.length === 0 && !semanticSearchError}
              >
                Semantische Suche zurücksetzen & Filter anzeigen
            </button>
          </div>

          {showFilters && !isSemanticModeActive && filterSection}
        </header>

        {/* Bereich für Batch-Aktionen */}
        {selectedDocumentIds.length > 0 && (
          <div className="mb-6 p-4 bg-sky-50 border border-sky-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-sky-700">
                {selectedDocumentIds.length} Dokument{selectedDocumentIds.length === 1 ? ' ist' : 'e sind'} ausgewählt.
              </p>
              <div>
                <button
                  onClick={handleBatchDelete}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 disabled:opacity-50"
                  disabled={isBatchDeleting}
                >
                  {isBatchDeleting ? 'Lösche...' : 'Ausgewählte löschen'}
                </button>
              </div>
            </div>
            {batchDeleteError && (
              <div className="mt-2 text-sm text-red-600">
                <p>Fehler: {batchDeleteError}</p>
              </div>
            )}
            {batchDeleteSuccessMessage && !batchDeleteError && (
              <div className="mt-2 text-sm text-green-600">
                <p>{batchDeleteSuccessMessage}</p>
              </div>
            )}
          </div>
        )}

        {/* Upload Section */}
        <div className="mb-8 p-6 bg-white rounded-xl shadow-lg border border-sky-200">
          <h2 className="text-xl font-semibold text-slate-700 mb-3">
            Neues Dokument hochladen
          </h2>
          <div className="space-y-3 md:space-y-0 md:flex md:items-end md:space-x-4">
            <div className="flex-grow">
              <label htmlFor="file-upload-library" className="block text-sm font-medium text-slate-700 mb-1">
                Dokument auswählen
              </label>
              <input 
                id="file-upload-library" 
                name="file-upload-library" 
                type="file" 
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                disabled={isUploading}
              />
            </div>
            <button
              type="button"
              onClick={handleFileUpload}
              disabled={!selectedFile || isUploading}
              className="w-full md:w-auto inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-60"
            >
              {isUploading ? (
                <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
              ) : (
                <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
              )}
              {isUploading ? 'Lade hoch...' : 'Hochladen'}
            </button>
          </div>
          {uploadError && (
            <div className="mt-3 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
              <p><strong>Upload Fehler:</strong> {uploadError}</p>
            </div>
          )}
          {uploadSuccessMessage && (
            <div className="mt-3 p-3 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm">
              <p>{uploadSuccessMessage}</p>
            </div>
          )}
        </div>

        {/* Fehlermeldung für KI-Vorschläge */}
        {suggestionError && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
            <p><strong>Fehler bei KI-Vorschlag:</strong> {suggestionError}</p>
          </div>
        )}

        {/* Document List */}
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">
            {isSemanticModeActive ? `Semantische Suchergebnisse für: "${semanticSearchQuery}"` : 'Vorhandene Dokumente'}
          </h2>
          
          {(isLoading || isSemanticSearching) && !documentsToDisplay.length && (
            <div className="text-center py-10">
              <ArrowPathIcon className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-500">Lade Dokumente...</p>
            </div>
          )}
          {error && !isSemanticModeActive && (
            <div className="my-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
              <p><strong>Fehler beim Laden der Dokumentenliste:</strong> {error}</p>
            </div>
          )}
          {!isLoading && !isSemanticModeActive && !error && documentsToDisplay.length === 0 && !searchTerm && currentPage === 1 && totalDocuments === 0 && (
            <p className="text-slate-500 text-center py-10">Keine Dokumente in der Bibliothek vorhanden.</p>
          )}
          {!isLoading && !isSemanticModeActive && !error && documentsToDisplay.length === 0 && (currentPage > 1 || searchTerm || filterStatus !== 'all' || filterFileType !== 'all' || filterDateFrom || filterDateTo) && (
             <div className="text-center py-10 bg-white p-6 rounded-lg shadow">
                <DocumentMagnifyingGlassIcon className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 font-semibold">Keine Dokumente gefunden.</p>
                <p className="text-sm text-slate-500">Ihre Suche oder Filterkriterien ergaben keine Treffer.</p>
             </div>
          )}
          {/* Hinweis für keine Ergebnisse bei semantischer Suche (redundant zu semanticSearchError, aber als Fallback) */}
          {isSemanticModeActive && !isSemanticSearching && documentsToDisplay.length === 0 && !semanticSearchError && (
             <div className="text-center py-10 bg-white p-6 rounded-lg shadow">
                <DocumentMagnifyingGlassIcon className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 font-semibold">Keine semantischen Ergebnisse.</p>
                <p className="text-sm text-slate-500">Ihre semantische Suche ergab keine Treffer oder der Schwellenwert war zu hoch.</p>
             </div>
          )}

          {!error && (isSemanticModeActive ? documentsToDisplay.length > 0 : totalDocuments > 0) && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left">
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          checked={documentsToDisplay.length > 0 && selectedDocumentIds.length === documentsToDisplay.length}
                          onChange={handleToggleSelectAll}
                          disabled={documentsToDisplay.length === 0}
                          aria-label="Alle Dokumente auf dieser Seite auswählen"
                        />
                      </th>
                      <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider ${!isSemanticModeActive ? 'cursor-pointer group' : ''}`} onClick={() => !isSemanticModeActive && handleSort('name')}>
                        Name {!isSemanticModeActive && renderSortIcon('name')}
                      </th>
                       {isSemanticModeActive && (
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Score
                        </th>
                      )}
                      <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider ${!isSemanticModeActive ? 'cursor-pointer group' : ''}`} onClick={() => !isSemanticModeActive && handleSort('size')}>
                        Größe {!isSemanticModeActive && renderSortIcon('size')}
                      </th>
                      <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider ${!isSemanticModeActive ? 'cursor-pointer group' : ''}`} onClick={() => !isSemanticModeActive && handleSort('lastModified')}>
                        Zuletzt geändert {!isSemanticModeActive && renderSortIcon('lastModified')}
                      </th>
                      <th scope="col" className={`px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider ${!isSemanticModeActive ? 'cursor-pointer group' : ''}`} onClick={() => !isSemanticModeActive && handleSort('status')}>
                        Freigabestatus {!isSemanticModeActive && renderSortIcon('status')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Indizierungsstatus
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {documentsToDisplay
                      .map((doc) => {
                        let statusBadgeColor = 'bg-gray-100 text-gray-800';
                        let statusText = doc.status ? doc.status.charAt(0).toUpperCase() + doc.status.slice(1) : 'N/A';

                        switch (doc.status) {
                          case 'draft':
                            statusBadgeColor = 'bg-slate-100 text-slate-700';
                            statusText = 'Entwurf';
                            break;
                          case 'inReview':
                            statusBadgeColor = 'bg-yellow-100 text-yellow-800';
                            statusText = 'In Prüfung';
                            break;
                          case 'approved':
                            statusBadgeColor = 'bg-green-100 text-green-800';
                            statusText = 'Genehmigt';
                            break;
                          case 'rejected':
                            statusBadgeColor = 'bg-red-100 text-red-800';
                            statusText = 'Abgelehnt';
                            break;
                          default:
                            statusText = doc.status || 'N/A'; // Fallback, falls Status undefiniert ist
                            break;
                        }

                        let embeddingStatusBadgeColor = 'bg-gray-100 text-gray-800';
                        let embeddingStatusText = 'Unbekannt';
                        switch (doc.embeddingStatus) {
                          case 'completed':
                            embeddingStatusBadgeColor = 'bg-green-100 text-green-800';
                            embeddingStatusText = 'Indiziert';
                            break;
                          case 'pending':
                            embeddingStatusBadgeColor = 'bg-yellow-100 text-yellow-800';
                            embeddingStatusText = 'Ausstehend';
                            break;
                          case 'processing':
                            embeddingStatusBadgeColor = 'bg-blue-100 text-blue-800';
                            embeddingStatusText = 'In Arbeit';
                            break;
                          case 'failed':
                            embeddingStatusBadgeColor = 'bg-red-100 text-red-800';
                            embeddingStatusText = 'Fehlgeschlagen';
                            break;
                        }

                        const isSelected = selectedDocumentIds.includes(doc._id);
                        return (
                          <tr key={doc._id} className={isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'}>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <input 
                                type="checkbox" 
                                className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                checked={isSelected}
                                onChange={() => handleToggleSelectDocument(doc._id)}
                                aria-labelledby={`document-name-${doc._id}`}
                              />
                            </td>
                            <td id={`document-name-${doc._id}`} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                              <Link href={`/document-viewer/${doc._id}`} className="hover:text-sky-700 hover:underline">
                                {doc.name}
                              </Link>
                            </td>
                            {isSemanticModeActive && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                {doc.searchScore !== undefined ? doc.searchScore.toFixed(4) : 'N/A'}
                              </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{(doc.size / 1024).toFixed(2)} KB</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(doc.lastModified).toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeColor}`}>
                                {statusText}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${embeddingStatusBadgeColor}`}>
                                {embeddingStatusText}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 flex items-center">
                              <button
                                onClick={() => handleAnalyzeDocument(doc._id)}
                                className="text-sky-600 hover:text-sky-800 disabled:opacity-50 p-1"
                                title="Dokument analysieren (Text extrahieren & Embedding)"
                              >
                                <DocumentMagnifyingGlassIcon className="h-5 w-5" />
                              </button>
                              <a 
                                href={`/api/documents/download/${doc.storageFilename}?originalFilename=${encodeURIComponent(doc.name)}&fileType=${encodeURIComponent(doc.fileType)}`}
                                className="text-green-600 hover:text-green-800 disabled:opacity-50 p-1"
                                title="Dokument herunterladen"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ArrowDownTrayIcon className="h-5 w-5" />
                              </a>
                              {canSuggestAiItems && (
                                <button
                                  onClick={() => handleSuggestRule(doc._id, doc.name)}
                                  disabled={isSuggesting}
                                  title="Regel basierend auf diesem Dokument vorschlagen"
                                  className="text-indigo-600 hover:text-indigo-900 disabled:text-slate-300 disabled:cursor-not-allowed p-1 rounded-md hover:bg-indigo-100 transition-colors"
                                >
                                  <LightBulbIcon className="h-5 w-5" />
                                </button>
                              )}
                              {canSuggestAiItems && (
                                <button
                                  onClick={() => handleSuggestRisk(doc._id, doc.name)}
                                  disabled={isSuggesting}
                                  title="Risiko basierend auf diesem Dokument vorschlagen"
                                  className="text-orange-500 hover:text-orange-700 disabled:text-slate-300 disabled:cursor-not-allowed p-1 rounded-md hover:bg-orange-100 transition-colors"
                                >
                                  <ExclamationTriangleIcon className="h-5 w-5" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteDocument(doc._id, doc.name)}
                                className="text-red-600 hover:text-red-800 disabled:opacity-50 p-1"
                                title="Dokument löschen"
                                disabled={!session?.user?.roles?.some(role => [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL].includes(role))}
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              
              {/* Paginierungs-Steuerung - Nur anzeigen, wenn nicht im semantischen Modus und totalPages > 1 */}
              {!isSemanticModeActive && currentTotalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                    >
                      Vorherige
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === currentTotalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                    >
                      Nächste
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-slate-700">
                        Zeige <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                        {' '}bis <span className="font-medium">{Math.min(currentPage * itemsPerPage, currentTotalDocuments)}</span>
                        {' '}von <span className="font-medium">{currentTotalDocuments}</span> Ergebnissen
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <span className="sr-only">Vorherige</span>
                          <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                        {/* Aktuell keine Seitenzahlen, um es einfach zu halten, kann erweitert werden */}
                        <span className="relative inline-flex items-center px-4 py-2 border border-slate-300 bg-white text-sm font-medium text-slate-700">
                          Seite {currentPage} von {currentTotalPages}
                        </span>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === currentTotalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <span className="sr-only">Nächste</span>
                          <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Global AI Analysis Section */}
        {canRunGlobalAnalysis && (
          <div className="container mx-auto px-4">
            <div className="my-6 p-4 bg-sky-50 border border-sky-200 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-sky-700 mb-2 flex items-center">
                <SparklesIcon className="h-5 w-5 mr-2 text-sky-600" />
                Globale KI-Analyse
              </h3>
              <p className="text-sm text-slate-600 mb-3">Automatisch Regeln und Risiken für alle Dokumente generieren lassen. Dies kann einige Zeit in Anspruch nehmen.</p>
              <button
                onClick={handleGlobalAiAnalysis}
                disabled={isGlobalAnalyzing}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-60 transition-opacity"
              >
                {isGlobalAnalyzing ? (
                  <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
                ) : (
                  <SparklesIcon className="h-5 w-5 mr-2" />
                )}
                {isGlobalAnalyzing ? 'Analyse läuft...' : 'Analyse für alle Dokumente starten'}
              </button>
              {globalAnalysisMessage && <p className="mt-2 text-sm text-green-700 bg-green-50 p-2 rounded-md">{globalAnalysisMessage}</p>}
              {globalAnalysisError && <p className="mt-2 text-sm text-red-700 bg-red-50 p-2 rounded-md">{globalAnalysisError}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hilfsfunktion zur Formatierung der Dateigröße (kann hier bleiben oder in utils verschoben werden)
function formatFileSize(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
} 