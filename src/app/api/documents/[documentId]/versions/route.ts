import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/authOptions";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

interface UserSession {
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        roles?: string[];
    };
}

const UPLOAD_DIR = path.join(process.cwd(), "persistent_uploads", "documents");

// Hilfsfunktion zum Überprüfen der Rollen
async function hasRequiredDocumentEditAccess(
    session: UserSession | null,
    document: any // Typ des Dokuments aus der DB
): Promise<boolean> {
    if (!session || !session.user || !session.user.roles) {
        return false;
    }
    if (session.user.roles.includes("admin")) {
        return true; // Admins dürfen alles
    }
    const editRoles = document.accessControl?.editRoles || [];
    // Benutzer muss mindestens eine der benötigten Rollen haben
    // ODER eine der allgemeinen Bearbeitungsrollen wie 'editor'
    const generalEditRoles = ["editor", "compliance_manager_full", "compliance_manager_write"]; 
    
    return (
        session.user.roles.some(role => generalEditRoles.includes(role)) ||
        editRoles.some((role: string) => session.user.roles?.includes(role))
    );
}

export async function POST(
    request: Request,
    { params }: { params: { documentId: string } }
) {
    const session = (await getServerSession(authOptions)) as UserSession | null;
    if (!session || !session.user) {
        return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
    }

    const { documentId } = params;
    if (!documentId || !ObjectId.isValid(documentId)) {
        return NextResponse.json(
            { message: "Ungültige Dokumenten-ID" },
            { status: 400 }
        );
    }

    try {
        const client = await clientPromise;
        const db = client.db();

        const existingDocument = await db
            .collection("documents")
            .findOne({ _id: new ObjectId(documentId) });

        if (!existingDocument) {
            return NextResponse.json(
                { message: "Dokument nicht gefunden" },
                { status: 404 }
            );
        }

        // Berechtigungsprüfung für das Bearbeiten
        const canEditDocument = await hasRequiredDocumentEditAccess(session, existingDocument);
        if (!canEditDocument) {
            return NextResponse.json(
                { message: "Keine Berechtigung, dieses Dokument zu bearbeiten/versionieren" },
                { status: 403 }
            );
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const changeDescription = formData.get("changeDescription") as string | null;

        if (!file) {
            return NextResponse.json({ message: "Keine Datei hochgeladen" }, { status: 400 });
        }

        // Sicherstellen, dass das Upload-Verzeichnis existiert
        await mkdir(UPLOAD_DIR, { recursive: true });

        const highestVersionEntry = await db
            .collection("documentVersions")
            .find({ documentId: existingDocument._id })
            .sort({ versionNumber: -1 })
            .limit(1)
            .toArray();
        
        const newVersionNumber = highestVersionEntry.length > 0 ? highestVersionEntry[0].versionNumber + 1 : 1;

        // Eindeutigen Dateinamen für die neue Version generieren
        // Basis ist der ursprüngliche storageFilename (UUID) des Dokuments, mit Suffix für Version
        const baseFilename = existingDocument.storageFilename.includes('.') 
            ? existingDocument.storageFilename.substring(0, existingDocument.storageFilename.lastIndexOf('.'))
            : existingDocument.storageFilename;
        const fileExtension = path.extname(file.name);
        const versionedStorageFilename = `${baseFilename}_v${newVersionNumber}${fileExtension}`;
        const versionedStoragePath = path.join(UPLOAD_DIR, versionedStorageFilename);

        // Datei speichern
        const bytes = await file.arrayBuffer();
        await writeFile(versionedStoragePath, Buffer.from(bytes));

        const newVersion = {
            _id: new ObjectId(),
            documentId: existingDocument._id,
            versionNumber: newVersionNumber,
            storagePath: versionedStorageFilename, // Nur der Dateiname, nicht der volle Pfad
            originalFilename: file.name, // Originalname der *neuen* Datei
            fileType: file.type,
            size: file.size,
            uploaderId: new ObjectId(session.user.id),
            createdAt: new Date(),
            changeDescription: changeDescription || undefined,
        };

        await db.collection("documentVersions").insertOne(newVersion);

        // Hauptdokument aktualisieren
        await db.collection("documents").updateOne(
            { _id: existingDocument._id },
            {
                $set: {
                    currentVersionId: newVersion._id,
                    updatedAt: new Date(),
                    embeddingStatus: "pending", // Muss neu indiziert werden
                    // Optional: OriginalFilename, Size, FileType des Hauptdokuments auch auf die der neuen Version setzen?
                    // Aktuell bleiben diese auf dem Stand des initialen Uploads, Versionen haben ihre eigenen Metadaten.
                    // Für Konsistenz könnte man auch hier die Daten der `newVersion` übernehmen:
                    originalFilename: newVersion.originalFilename,
                    fileType: newVersion.fileType,
                    size: newVersion.size,
                    storageFilename: versionedStorageFilename, // Wichtig: Hauptdokument zeigt jetzt auf die neue Datei!
                },
            }
        );

        // Asynchronen Analyseprozess für die neue Version anstoßen (Fire-and-Forget)
        // Der Analyse-Endpunkt erwartet documentId
        // Der Pfad für die Analyse wird intern im Analyse-Endpunkt anhand der documentId und currentVersionId geholt
        fetch(`${process.env.NEXTAUTH_URL}/api/rules/analyze-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: existingDocument._id.toString() }),
        }).catch(console.error); 
        // TODO: Fehlerbehandlung für den asynchronen Aufruf verbessern (Logging, etc.)

        // Aktualisiertes Dokument mit allen Versionen zurückgeben
        const updatedDocumentWithVersions = await db.collection("documents").findOne({ _id: existingDocument._id });
        const allVersions = await db.collection("documentVersions").find({ documentId: existingDocument._id }).sort({versionNumber: -1}).toArray();
        
        // Uploader-Name für das Hauptdokument anreichern (optional, falls benötigt)
        let uploaderName = "Unbekannt";
        if (updatedDocumentWithVersions && updatedDocumentWithVersions.uploaderId) {
             try {
                const uploader = await db.collection("users").findOne({ _id: new ObjectId(updatedDocumentWithVersions.uploaderId) });
                if (uploader) uploaderName = uploader.name || uploader.email || "Unbekannt";
            } catch(e) { console.warn("Konnte Uploader für Haupt-Doc nicht laden", e); }
        }

        let statusChangedByName = "N/A";
        if (updatedDocumentWithVersions && updatedDocumentWithVersions.statusChangedBy) {
            try {
                const statusChanger = await db
                    .collection("users")
                    .findOne({ _id: new ObjectId(updatedDocumentWithVersions.statusChangedBy) });
                if (statusChanger) {
                    statusChangedByName = statusChanger.name || statusChanger.email || "Unbekannt";
                }
            } catch (e) {
                console.warn("Konnte statusChangedBy für Haupt-Doc nicht laden:", e);
            }
        }

        return NextResponse.json({ 
            ...updatedDocumentWithVersions, 
            versions: allVersions, 
            uploaderName,
            statusChangedByName 
        }, { status: 200 });

    } catch (error: any) {
        console.error("Fehler beim Erstellen einer neuen Version:", error);
        return NextResponse.json(
            { message: error.message || "Fehler beim Erstellen einer neuen Version" },
            { status: 500 }
        );
    }
} 