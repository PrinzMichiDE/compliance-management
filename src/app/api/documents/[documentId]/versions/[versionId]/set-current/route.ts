import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/authOptions";

interface UserSession {
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        roles?: string[];
    };
}

// Hilfsfunktion zum Überprüfen der Rollen (kann auch aus einer zentralen Util-Datei importiert werden)
async function hasRequiredDocumentEditAccess(
    session: UserSession | null,
    document: any // Typ des Dokuments aus der DB
): Promise<boolean> {
    if (!session || !session.user || !session.user.roles) {
        return false;
    }
    if (session.user.roles.includes("admin")) {
        return true;
    }
    const editRoles = document.accessControl?.editRoles || [];
    const generalEditRoles = ["editor", "compliance_manager_full", "compliance_manager_write"]; 
    
    return (
        session.user.roles.some(role => generalEditRoles.includes(role)) ||
        editRoles.some((role: string) => session.user.roles?.includes(role))
    );
}

export async function POST(
    request: Request,
    { params }: { params: { documentId: string; versionId: string } }
) {
    const session = (await getServerSession(authOptions)) as UserSession | null;
    if (!session || !session.user) {
        return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
    }

    const { documentId, versionId } = params;
    if (
        !documentId || !ObjectId.isValid(documentId) ||
        !versionId || !ObjectId.isValid(versionId)
    ) {
        return NextResponse.json(
            { message: "Ungültige Dokumenten- oder Versions-ID" },
            { status: 400 }
        );
    }

    try {
        const client = await clientPromise;
        const db = client.db();

        const mainDocument = await db
            .collection("documents")
            .findOne({ _id: new ObjectId(documentId) });

        if (!mainDocument) {
            return NextResponse.json(
                { message: "Hauptdokument nicht gefunden" },
                { status: 404 }
            );
        }

        // Berechtigungsprüfung für das Bearbeiten des Hauptdokuments
        const canEditDocument = await hasRequiredDocumentEditAccess(session, mainDocument);
        if (!canEditDocument) {
            return NextResponse.json(
                { message: "Keine Berechtigung, dieses Dokument zu bearbeiten" },
                { status: 403 }
            );
        }

        const targetVersion = await db
            .collection("documentVersions")
            .findOne({ 
                _id: new ObjectId(versionId), 
                documentId: new ObjectId(documentId) 
            });

        if (!targetVersion) {
            return NextResponse.json(
                { message: "Zielversion nicht gefunden oder gehört nicht zum Dokument" },
                { status: 404 }
            );
        }

        // Hauptdokument aktualisieren
        await db.collection("documents").updateOne(
            { _id: new ObjectId(documentId) },
            {
                $set: {
                    currentVersionId: targetVersion._id,
                    updatedAt: new Date(),
                    // Metadaten des Hauptdokuments mit denen der Zielversion aktualisieren
                    originalFilename: targetVersion.originalFilename,
                    fileType: targetVersion.fileType,
                    size: targetVersion.size,
                    storageFilename: targetVersion.storagePath, // Wichtig: Dateipfad der Zielversion wird zum Haupt-Dateipfad
                    embeddingStatus: "pending", // Muss neu bewertet/indiziert werden
                    // Ggf. auch lastIndexedAt zurücksetzen oder entfernen
                    lastIndexedAt: null, 
                },
            }
        );
        
        // Asynchronen Analyseprozess für die nun aktuelle Version anstoßen (Fire-and-Forget)
        fetch(`${process.env.NEXTAUTH_URL}/api/rules/analyze-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: mainDocument._id.toString() }),
        }).catch(console.error);

        // Aktualisiertes Hauptdokument mit allen Versionen und angereichertem Uploader-Namen zurückgeben
        const updatedDocumentAfterSetCurrent = await db.collection("documents").findOne({ _id: new ObjectId(documentId) });
        const allVersions = await db.collection("documentVersions").find({ documentId: new ObjectId(documentId) }).sort({versionNumber: -1}).toArray();
        
        let uploaderName = "Unbekannt";
        if (updatedDocumentAfterSetCurrent && updatedDocumentAfterSetCurrent.uploaderId) {
             try {
                const uploader = await db.collection("users").findOne({ _id: new ObjectId(updatedDocumentAfterSetCurrent.uploaderId) });
                if (uploader) uploaderName = uploader.name || uploader.email || "Unbekannt";
            } catch(e) { /* Fehler beim Laden des Uploaders ignorieren oder loggen */ }
        }

        let statusChangedByName = "N/A";
        if (updatedDocumentAfterSetCurrent && updatedDocumentAfterSetCurrent.statusChangedBy) {
            try {
                const statusChanger = await db
                    .collection("users")
                    .findOne({ _id: new ObjectId(updatedDocumentAfterSetCurrent.statusChangedBy) });
                if (statusChanger) {
                    statusChangedByName = statusChanger.name || statusChanger.email || "Unbekannt";
                }
            } catch (e) {
                 /* Fehler ignorieren oder loggen */
            }
        }

        return NextResponse.json({ 
            ...updatedDocumentAfterSetCurrent, 
            versions: allVersions, 
            uploaderName,
            statusChangedByName 
        }, { status: 200 });

    } catch (error: any) {
        console.error("Fehler beim Festlegen der aktuellen Version:", error);
        return NextResponse.json(
            { message: error.message || "Fehler beim Festlegen der aktuellen Version" },
            { status: 500 }
        );
    }
} 