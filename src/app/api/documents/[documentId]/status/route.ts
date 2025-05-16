import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/authOptions";

type DocumentStatus = 'draft' | 'inReview' | 'approved' | 'rejected';

interface UserSession {
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        roles?: string[];
    };
}

// Hilfsfunktion für Berechtigungen zur Statusänderung (vereinfacht)
// TODO: Ausdifferenzieren, wer welchen Status setzen darf.
// z.B. 'editor' darf 'draft' -> 'inReview'
// 'reviewer', 'admin' darf 'inReview' -> 'approved'/'rejected'
async function canChangeStatus(
    session: UserSession | null,
    document: any, // Typ des Dokuments aus der DB
    currentStatus: DocumentStatus | undefined,
    targetStatus: DocumentStatus
): Promise<boolean> {
    if (!session || !session.user || !session.user.roles) return false;
    const userRoles = session.user.roles;

    if (userRoles.includes("admin")) return true; // Admins dürfen alles

    // Beispielhafte Logik (muss verfeinert werden):
    if (currentStatus === 'draft' && targetStatus === 'inReview') {
        return userRoles.some(r => ["editor", "compliance_manager_write", "compliance_manager_full"].includes(r));
    }
    if (currentStatus === 'inReview' && (targetStatus === 'approved' || targetStatus === 'rejected' || targetStatus === 'draft')) {
        return userRoles.some(r => ["reviewer", "compliance_manager_full"].includes(r));
    }
    if ((currentStatus === 'approved' || currentStatus === 'rejected') && targetStatus === 'draft'){
        return userRoles.some(r => ["editor", "compliance_manager_write", "compliance_manager_full"].includes(r));
    }

    // Fallback, falls keine spezifische Regel passt (eher restriktiv)
    return false; 
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
        const { status: targetStatus } = (await request.json()) as { status: DocumentStatus };

        if (!targetStatus || !['draft', 'inReview', 'approved', 'rejected'].includes(targetStatus)) {
            return NextResponse.json({ message: "Ungültiger Zielstatus" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        const document = await db
            .collection("documents")
            .findOne({ _id: new ObjectId(documentId) });

        if (!document) {
            return NextResponse.json(
                { message: "Dokument nicht gefunden" },
                { status: 404 }
            );
        }

        // Berechtigungsprüfung
        const hasPermission = await canChangeStatus(session, document, document.status as DocumentStatus | undefined, targetStatus);
        if (!hasPermission) {
             return NextResponse.json(
                { message: "Keine Berechtigung, diesen Statuswechsel durchzuführen" },
                { status: 403 }
            );
        }

        const updateResult = await db.collection("documents").updateOne(
            { _id: new ObjectId(documentId) },
            {
                $set: {
                    status: targetStatus,
                    updatedAt: new Date(),
                    statusChangedAt: new Date(), // Optional: separates Feld für Statusänderung
                    statusChangedBy: new ObjectId(session.user.id), // Optional: Wer hat Status geändert
                },
            }
        );

        if (updateResult.modifiedCount === 0 && updateResult.matchedCount === 0) {
             return NextResponse.json(
                { message: "Dokument nicht gefunden für Statusupdate." },
                { status: 404 }
            );
        } 
        // Falls matched aber nicht modified, könnte der Status bereits der Zielstatus sein (nicht unbedingt ein Fehler)


        // Aktualisiertes Dokument mit allen Versionen und Uploader-Namen zurückgeben (wie in anderen Endpunkten)
        const updatedDocument = await db.collection("documents").findOne({ _id: new ObjectId(documentId) });
        const allVersions = await db.collection("documentVersions").find({ documentId: new ObjectId(documentId) }).sort({versionNumber: -1}).toArray();
        
        let uploaderName = "Unbekannt";
        if (updatedDocument && updatedDocument.uploaderId) {
             try {
                const uploader = await db.collection("users").findOne({ _id: new ObjectId(updatedDocument.uploaderId) });
                if (uploader) uploaderName = uploader.name || uploader.email || "Unbekannt";
            } catch(e) { /* Fehler ignorieren oder loggen */}
        }

        let statusChangedByName = "N/A";
        // Da wir gerade den Status geändert haben, ist session.user.name der aktuelle statusChangedByName
        // Falls der User keinen Namen hat, nehmen wir die E-Mail.
        // Die DB Abfrage ist hier redundant, wenn der aktuelle User die Änderung vornimmt.
        // Wir nehmen den Namen aus der Session, da statusChangedBy gerade erst gesetzt wurde.
        if (updatedDocument && updatedDocument.statusChangedBy && session.user.id === updatedDocument.statusChangedBy.toString()) {
            statusChangedByName = session.user.name || session.user.email || "Unbekannt";
        } else if (updatedDocument && updatedDocument.statusChangedBy) {
            // Fallback, falls die ID nicht übereinstimmt oder für ältere Änderungen
             try {
                const statusChanger = await db.collection("users").findOne({ _id: new ObjectId(updatedDocument.statusChangedBy) });
                if (statusChanger) statusChangedByName = statusChanger.name || statusChanger.email || "Unbekannt";
            } catch(e) { /* Fehler ignorieren oder loggen */}
        }

        return NextResponse.json({ 
            ...updatedDocument, 
            versions: allVersions, 
            uploaderName,
            statusChangedByName
        }, { status: 200 });

    } catch (error: any) {
        console.error("Fehler beim Aktualisieren des Dokumentstatus:", error);
        return NextResponse.json(
            { message: error.message || "Fehler beim Aktualisieren des Dokumentstatus" },
            { status: 500 }
        );
    }
} 