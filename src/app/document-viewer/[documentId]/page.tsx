'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation'; // korrigiert von next/navigation
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { DocumentArrowUpIcon as DocumentArrowUpIconOutline } from '@heroicons/react/24/outline'; // Alias um Konflikt zu vermeiden
import { CheckCircleIcon } from '@heroicons/react/24/solid'; // Für den "Als aktuell festlegen" Button
import { PaperAirplaneIcon, CheckBadgeIcon, XCircleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { UserRole } from '@/types/enums'; // Annahme: UserRole Enum ist hier definiert

interface DocumentVersion {
    _id: string;
    documentId: string;
    versionNumber: number;
    storagePath: string;
    originalFilename: string;
    size: number;
    fileType: string;
    uploaderId: string;
    createdAt: string;
    changeDescription?: string;
}

type DocumentStatus = 'draft' | 'inReview' | 'approved' | 'rejected';

interface DocumentDetails {
    _id: string;
    originalFilename: string;
    storageFilename: string; // Der eindeutige Name für den Storage (UUID.ext)
    fileType: string;
    size: number;
    createdAt: string;
    updatedAt: string;
    uploaderId: string;
    uploaderName?: string;
    embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'none';
    embeddingVector?: number[];
    lastIndexedAt?: string;
    status?: DocumentStatus;
    accessControl?: {
        viewRoles?: string[];
        editRoles?: string[];
    };
    currentVersionId: string;
    versions: DocumentVersion[];
    extractedText?: string; // Falls wir das später hinzufügen wollen
    statusChangedAt?: string; // ISO String
    statusChangedByName?: string;
}

const getStatusColor = (status: DocumentDetails['embeddingStatus']) => {
    switch (status) {
        case 'completed':
            return 'bg-green-500';
        case 'processing':
            return 'bg-yellow-500 animate-pulse';
        case 'pending':
            return 'bg-blue-500';
        case 'failed':
            return 'bg-red-500';
        default:
            return 'bg-gray-400';
    }
};

export default function DocumentViewerPage() {
    const params = useParams();
    const documentId = params?.documentId as string;
    const router = useRouter();
    const { data: session, status: sessionStatus } = useSession();
    const [document, setDocument] = useState<DocumentDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
    const [changeDescription, setChangeDescription] = useState<string>('');
    const [isUploadingNewVersion, setIsUploadingNewVersion] = useState(false);
    const [uploadNewVersionError, setUploadNewVersionError] = useState<string | null>(null);
    const [showNewVersionUpload, setShowNewVersionUpload] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (sessionStatus === 'loading' || !documentId) return;
        if (sessionStatus === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (documentId) {
            const fetchDocumentDetails = async () => {
                setLoading(true);
                setError(null);
                try {
                    const response = await fetch(`/api/documents/${documentId}`);
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(
                            errorData.message ||
                                `Fehler beim Laden des Dokuments: ${response.status}`
                        );
                    }
                    const data = await response.json();
                    setDocument(data);
                } catch (err: any) {
                    console.error("Fehler beim Abrufen der Dokumentdetails:", err);
                    setError(err.message || 'Ein unbekannter Fehler ist aufgetreten.');
                }
                setLoading(false);
            };
            fetchDocumentDetails();
        }
    }, [documentId, router, sessionStatus]);

    if (loading || sessionStatus === 'loading') {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8 text-red-500 text-center">
                <p>Fehler: {error}</p>
                <Link href="/document-library" className="text-blue-500 hover:underline">
                    Zurück zur Dokumentenbibliothek
                </Link>
            </div>
        );
    }

    if (!document) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <p>Dokument nicht gefunden.</p>
                <Link href="/document-library" className="text-blue-500 hover:underline">
                    Zurück zur Dokumentenbibliothek
                </Link>
            </div>
        );
    }
    
    const currentVersion = document.versions.find(v => v._id === document.currentVersionId) || document.versions[0];

    const handleDownload = (versionToDownload: DocumentVersion) => {
        // Jede Version hat ihren eigenen storagePath (Dateiname im persistent_uploads/documents Verzeichnis).
        // Dieser wird direkt für den Download-Pfad verwendet.
        // Der originalFilename und fileType werden vom Hauptdokument genommen, da diese sich für das "Dokument" an sich
        // nicht ändern, auch wenn eine neue Version hochgeladen wird. Die Version selbst hat auch originalFilename etc.,
        // aber für den Download-Dialog ist der Name des übergeordneten Dokuments oft sinnvoller.
        // Falls gewünscht, könnte man auch versionToDownload.originalFilename verwenden.

        if (!versionToDownload.storagePath) {
            console.error("Kein storagePath für die Version vorhanden:", versionToDownload);
            alert("Fehler: Speicherpfad für diese Version ist nicht verfügbar.");
            return;
        }

        window.location.href = `/api/documents/download/${versionToDownload.storagePath}?originalFilename=${encodeURIComponent(document.originalFilename)}&fileType=${encodeURIComponent(document.fileType)}`;
    };
    
    const handleAnalyze = () => {
        if (!document || !currentVersion) return;
        // Der Analyse-Viewer erwartet filePath (konstruiert aus storageFilename),
        // fileType, fileName (original) und documentId.
        // Der `filePath` sollte relativ zum `persistent_uploads/documents` Ordner sein.
        const params = new URLSearchParams({
            filePath: document.storageFilename, // storageFilename ist der Name in persistent_uploads/documents
            fileType: document.fileType,
            fileName: document.originalFilename,
            documentId: document._id,
        });
        router.push(`/document-analysis-viewer?${params.toString()}`);
    };

    const handleNewVersionFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setNewVersionFile(event.target.files[0]);
            setUploadNewVersionError(null);
        }
    };

    const handleUploadNewVersion = async () => {
        if (!newVersionFile || !document) {
            setUploadNewVersionError(
                'Bitte wählen Sie eine Datei für die neue Version aus.'
            );
            return;
        }

        setIsUploadingNewVersion(true);
        setUploadNewVersionError(null);

        const formData = new FormData();
        formData.append('file', newVersionFile);
        formData.append('changeDescription', changeDescription);
        // documentId wird aus der URL genommen

        try {
            const response = await fetch(`/api/documents/${document._id}/versions`, {
                method: 'POST',
                body: formData,
                // Kein 'Content-Type': 'application/json' bei FormData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.message || `Fehler beim Hochladen der neuen Version (HTTP ${response.status})`
                );
            }
            const updatedDocument = await response.json();
            setDocument(updatedDocument); // Aktualisiere das Dokument im State mit der Antwort
            setShowNewVersionUpload(false); // Schließe den Upload-Bereich
            setNewVersionFile(null);
            setChangeDescription('');
            alert('Neue Version erfolgreich hochgeladen.');
        } catch (err: any) {
            console.error("Fehler beim Hochladen der neuen Version:", err);
            setUploadNewVersionError(err.message || 'Ein unbekannter Fehler ist aufgetreten.');
        } finally {
            setIsUploadingNewVersion(false);
        }
    };

    const handleSetCurrentVersion = async (versionToSetCurrent: DocumentVersion) => {
        if (!document) return;
        if (versionToSetCurrent._id === document.currentVersionId) {
            alert("Diese Version ist bereits die aktuelle Version.");
            return;
        }

        if (!confirm(`Sind Sie sicher, dass Sie Version ${versionToSetCurrent.versionNumber} als aktuelle Version festlegen möchten? Der Inhalt und die Metadaten des Dokuments werden auf diese Version zurückgesetzt.`)) {
            return;
        }

        setIsLoading(true); // Allgemeinen Ladezustand nutzen oder einen spezifischen für diese Aktion
        setError(null);

        try {
            const response = await fetch(`/api/documents/${document._id}/versions/${versionToSetCurrent._id}/set-current`, {
                method: 'POST',
                // Kein Body notwendig, IDs sind in der URL
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Festlegen der aktuellen Version');
            }

            const updatedDocument = await response.json();
            setDocument(updatedDocument);
            alert(`Version ${versionToSetCurrent.versionNumber} wurde als aktuell festgelegt.`);

        } catch (err: any) {
            console.error("Fehler beim Festlegen der aktuellen Version:", err);
            setError(err.message || 'Ein unbekannter Fehler ist aufgetreten.');
            alert(`Fehler: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangeStatus = async (newStatus: DocumentStatus) => {
        if (!document) return;

        let confirmMessage = `Sind Sie sicher, dass Sie den Status auf "${newStatus}" ändern möchten?`;
        if (newStatus === 'approved') confirmMessage = "Möchten Sie dieses Dokument genehmigen?";
        if (newStatus === 'rejected') confirmMessage = "Möchten Sie dieses Dokument ablehnen?";
        if (newStatus === 'inReview') confirmMessage = "Möchten Sie dieses Dokument zur Überprüfung einreichen?";

        if (!confirm(confirmMessage)) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/documents/${document._id}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Fehler beim Ändern des Dokumentstatus');
            }
            const updatedDocument = await response.json();
            setDocument(updatedDocument);
            alert(`Dokumentstatus erfolgreich auf "${newStatus}" geändert.`);
        } catch (err: any) {
            console.error("Fehler beim Ändern des Status:", err);
            setError(err.message || 'Ein unbekannter Fehler ist aufgetreten.');
            alert(`Fehler beim Ändern des Status: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusDisplayProperties = (status?: DocumentStatus) => {
        switch (status) {
            case 'draft':
                return { text: 'Entwurf', color: 'bg-gray-500', icon: <PencilSquareIcon className="h-5 w-5 inline mr-1 mb-0.5"/> };
            case 'inReview':
                return { text: 'In Überprüfung', color: 'bg-yellow-500', icon: <PaperAirplaneIcon className="h-5 w-5 inline mr-1 mb-0.5"/> };
            case 'approved':
                return { text: 'Genehmigt', color: 'bg-green-500', icon: <CheckBadgeIcon className="h-5 w-5 inline mr-1 mb-0.5"/> };
            case 'rejected':
                return { text: 'Abgelehnt', color: 'bg-red-500', icon: <XCircleIcon className="h-5 w-5 inline mr-1 mb-0.5"/> };
            default:
                return { text: 'Unbekannt', color: 'bg-gray-400', icon: null };
        }
    };

    // Verfeinerte Logik für Workflow Buttons
    const canSubmitForReview = document?.status === 'draft' && 
                               session?.user?.roles?.some(r => 
                                   [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_WRITE, UserRole.COMPLIANCE_MANAGER_FULL].includes(r as UserRole)
                               );

    const canReview = document?.status === 'inReview' && 
                      session?.user?.roles?.some(r => 
                          [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_READ, UserRole.COMPLIANCE_MANAGER_FULL].includes(r as UserRole)
                      );

    const canRevise = (document?.status === 'approved' || document?.status === 'rejected') &&
                      session?.user?.roles?.some(r => 
                          [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_WRITE, UserRole.COMPLIANCE_MANAGER_FULL].includes(r as UserRole)
                      );

    return (
        <div className="container mx-auto px-4 py-8 bg-gray-900 text-white min-h-screen">
            <div className="bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-blue-400 mb-2">
                            {document.originalFilename}
                        </h1>
                        <p className="text-sm text-gray-400">
                            Hochgeladen von: {document.uploaderName || 'Unbekannt'} am {
                                new Date(document.createdAt).toLocaleDateString('de-DE')
                            }
                        </p>
                    </div>
                    <Link 
                        href="/document-library"
                        className="text-blue-400 hover:text-blue-300 transition duration-150 ease-in-out"
                    >
                        &larr; Zurück zur Bibliothek
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <h3 className="font-semibold text-lg text-blue-300 mb-1">Dateityp</h3>
                        <p className="text-gray-300">{document.fileType}</p>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <h3 className="font-semibold text-lg text-blue-300 mb-1">Größe</h3>
                        <p className="text-gray-300">
                            {(document.size / 1024).toFixed(2)} KB
                        </p>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg">
                        <h3 className="font-semibold text-lg text-blue-300 mb-1">Indizierungsstatus</h3>
                        <span
                            className={`px-3 py-1 text-sm font-semibold rounded-full text-white ${getStatusColor(
                                document.embeddingStatus
                            )}`}
                        >
                            {document.embeddingStatus || 'N/A'}
                        </span>
                    </div>
                </div>

                {document.embeddingStatus === 'completed' && document.lastIndexedAt && (
                     <p className="text-sm text-gray-400 mb-4">
                        Zuletzt indiziert am: {new Date(document.lastIndexedAt).toLocaleString('de-DE')}
                    </p>
                )}

                <div className="flex space-x-4 mb-8">
                    {currentVersion && (
                         <button
                            onClick={() => handleDownload(currentVersion)}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
                        >
                            Aktuelle Version herunterladen
                        </button>
                    )}
                    <button
                        onClick={handleAnalyze}
                        disabled={document.embeddingStatus === 'processing'}
                        className={`font-bold py-2 px-4 rounded transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-50 ${ 
                            document.embeddingStatus === 'processing' 
                            ? 'bg-gray-500 text-gray-300 cursor-not-allowed' 
                            : 'bg-green-500 hover:bg-green-600 text-white focus:ring-green-400'
                        }`}
                    >
                        {document.embeddingStatus === 'processing' ? 'Analyse läuft...' : 'Dokument analysieren/neu analysieren'}
                    </button>
                </div>

                {document.extractedText && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold text-blue-300 mb-3">Extrahierter Text</h2>
                        <div className="bg-gray-700 p-4 rounded-lg max-h-96 overflow-y-auto">
                            <pre className="whitespace-pre-wrap text-gray-300">{document.extractedText}</pre>
                        </div>
                    </div>
                )}

                <div>
                    <h2 className="text-2xl font-semibold text-blue-300 mb-4">Versionen</h2>
                    {document.versions && document.versions.length > 0 ? (
                        <ul className="space-y-3">
                            {document.versions.map((version) => (
                                <li 
                                    key={version._id}
                                    className={`p-4 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center transition-all duration-200 ease-in-out ${version._id === document.currentVersionId ? 'bg-blue-600 shadow-lg ring-2 ring-blue-400' : 'bg-gray-700 hover:bg-gray-600'}`}
                                >
                                    <div className="mb-3 sm:mb-0">
                                        <p className="font-semibold text-lg">
                                            Version {version.versionNumber}
                                            {version._id === document.currentVersionId && <span className="ml-2 text-xs font-normal px-2 py-0.5 bg-green-500 text-white rounded-full">Aktuell</span>}
                                        </p>
                                        <p className="text-sm text-gray-300">
                                            Datei: {version.originalFilename} ({(version.size / 1024).toFixed(2)} KB)
                                        </p>
                                        <p className="text-sm text-gray-300">
                                            Hochgeladen am: {new Date(version.createdAt).toLocaleString('de-DE')}
                                        </p>
                                        {version.changeDescription && (
                                            <p className="text-sm text-gray-400 mt-1">
                                                Änderung: {version.changeDescription}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mt-2 sm:mt-0">
                                        <button 
                                            onClick={() => handleDownload(version)} 
                                            className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-4 rounded text-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-50"
                                        >
                                            Version herunterladen
                                        </button>
                                        {version._id !== document.currentVersionId && (
                                            <button
                                                onClick={() => handleSetCurrentVersion(version)}
                                                disabled={isLoading} // Verhindert mehrfache Klicks während der Verarbeitung
                                                className="w-full sm:w-auto mt-2 sm:mt-0 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded text-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50 disabled:opacity-50"
                                            >
                                                <CheckCircleIcon className="h-4 w-4 inline mr-1" />
                                                Als aktuell festlegen
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-400">Keine Versionen verfügbar.</p>
                    )}
                </div>
                
                {/* Placeholder für Freigabe-Workflow */}
                <div className="mt-8 p-6 bg-gray-700 rounded-lg">
                    <h2 className="text-2xl font-semibold text-blue-300 mb-4">Freigabestatus</h2>
                    <div className="flex items-center mb-1">
                        <p className="text-gray-300 mr-2">Aktueller Status:</p>
                        <span
                            className={`px-3 py-1 text-sm font-semibold rounded-full text-white ${getStatusDisplayProperties(document?.status).color}`}
                        >
                            {getStatusDisplayProperties(document?.status).icon}
                            {getStatusDisplayProperties(document?.status).text}
                        </span>
                    </div>
                    {document?.statusChangedAt && (
                        <p className="text-sm text-gray-400 mb-4">
                            Zuletzt geändert am: {new Date(document.statusChangedAt).toLocaleString('de-DE')} 
                            von: {document.statusChangedByName || 'Unbekannt'}
                        </p>
                    )}
                    
                    <div className="flex flex-wrap gap-3">
                        {canSubmitForReview && (
                            <button 
                                onClick={() => handleChangeStatus('inReview')}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out flex items-center"
                                disabled={isLoading}
                            >
                                <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                                Zur Überprüfung einreichen
                            </button>
                        )}
                        {canReview && (
                            <>
                                <button 
                                    onClick={() => handleChangeStatus('approved')}
                                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out flex items-center"
                                    disabled={isLoading}
                                >
                                    <CheckBadgeIcon className="h-5 w-5 mr-2"/>
                                    Genehmigen
                                </button>
                                <button 
                                    onClick={() => handleChangeStatus('rejected')}
                                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out flex items-center"
                                    disabled={isLoading}
                                >
                                    <XCircleIcon className="h-5 w-5 mr-2" />
                                    Ablehnen
                                </button>
                                <button 
                                    onClick={() => handleChangeStatus('draft')}
                                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out flex items-center"
                                    disabled={isLoading}
                                >
                                    Zurück zu Entwurf
                                </button>
                            </>
                        )}
                         {canRevise && document?.status === 'approved' && (
                            <button 
                                onClick={() => handleChangeStatus('draft')}
                                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out flex items-center"
                                disabled={isLoading}
                            >
                                <PencilSquareIcon className="h-5 w-5 mr-2" />
                                Revision starten (Entwurf)
                            </button>
                        )}
                        {canRevise && document?.status === 'rejected' && (
                             <button 
                                onClick={() => handleChangeStatus('draft')}
                                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out flex items-center"
                                disabled={isLoading}
                            >
                                <PencilSquareIcon className="h-5 w-5 mr-2" />
                                Erneut bearbeiten (Entwurf)
                            </button>
                        )}
                    </div>
                </div>

                {/* Section for new version upload */}
                <div className="my-8">
                    <button
                        onClick={() => setShowNewVersionUpload(!showNewVersionUpload)}
                        className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-50 mb-4"
                    >
                        {showNewVersionUpload ? 'Upload-Bereich schließen' : 'Neue Version hochladen'}
                    </button>

                    {showNewVersionUpload && (
                        <div className="p-6 bg-gray-700 rounded-lg shadow-md">
                            <h3 className="text-xl font-semibold text-blue-300 mb-3">
                                Neue Version für "{document.originalFilename}" erstellen
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="new-version-file-upload" className="block text-sm font-medium text-gray-300 mb-1">
                                        Neue Datei auswählen
                                    </label>
                                    <input 
                                        id="new-version-file-upload" 
                                        type="file" 
                                        onChange={handleNewVersionFileChange}
                                        className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-gray-200 hover:file:bg-gray-500 disabled:opacity-50"
                                        disabled={isUploadingNewVersion}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="change-description" className="block text-sm font-medium text-gray-300 mb-1">
                                        Änderungsbeschreibung (optional)
                                    </label>
                                    <textarea
                                        id="change-description"
                                        rows={3}
                                        value={changeDescription}
                                        onChange={(e) => setChangeDescription(e.target.value)}
                                        className="w-full px-3 py-2 text-gray-300 bg-gray-600 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                                        placeholder="z.B. Rechtschreibfehler korrigiert, Abschnitt 2.1 aktualisiert"
                                        disabled={isUploadingNewVersion}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleUploadNewVersion}
                                    disabled={!newVersionFile || isUploadingNewVersion}
                                    className="w-full inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-green-500 rounded-md shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-700 focus:ring-green-400 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isUploadingNewVersion ? (
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <DocumentArrowUpIconOutline className="h-5 w-5 mr-2" /> 
                                    )}
                                    {isUploadingNewVersion ? 'Lade hoch...' : 'Neue Version speichern'}
                                </button>
                                {uploadNewVersionError && (
                                    <div className="mt-3 p-3 bg-red-700 text-red-100 border border-red-500 rounded-md text-sm">
                                        <p><strong>Fehler:</strong> {uploadNewVersionError}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
} 