import { NextResponse } from "next/server";
import { getSession } from "next-auth/react";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { authOptions } from "@/lib/authOptions"; // Annahme, dass authOptions hier existiert
import { getServerSession } from "next-auth/next";

interface UserSession {
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        roles?: string[];
    };
}

// Hilfsfunktion zum Überprüfen der Rollen (kopiert aus einer anderen Route, ggf. anpassen/auslagern)
async function hasRequiredRole(
    session: UserSession | null,
    requiredRoles: string[]
): Promise<boolean> {
    if (!session || !session.user || !session.user.roles) {
        return false;
    }
    return requiredRoles.some((role) => session.user.roles?.includes(role));
}

export async function GET(
    request: Request,
    { params }: { params: { documentId: string } }
) {
    const session = (await getServerSession(authOptions)) as UserSession | null;

    if (!session) {
        return NextResponse.json({ message: "Nicht autorisiert" }, { status: 401 });
    }

    const canViewDocuments = await hasRequiredRole(session, [
        "admin",
        "viewer",
        "editor",
    ]); // Beispielrollen, anpassen
    if (!canViewDocuments) {
        return NextResponse.json(
            { message: "Keine Berechtigung zum Anzeigen von Dokumenten" },
            { status: 403 }
        );
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

        const document = await db
            .collection("documents")
            .findOne({ _id: new ObjectId(documentId) });

        if (!document) {
            return NextResponse.json(
                { message: "Dokument nicht gefunden" },
                { status: 404 }
            );
        }

        // Überprüfen der Zugriffsberechtigungen auf Dokumentenebene
        const userRoles = session.user.roles || [];
        const viewRoles = document.accessControl?.viewRoles || [];

        const canViewSpecificDocument =
            userRoles.includes("admin") || // Admins können alles sehen
            viewRoles.some((role: string) => userRoles.includes(role));

        if (!canViewSpecificDocument) {
            return NextResponse.json(
                {
                    message:
                        "Keine Berechtigung zum Anzeigen dieses spezifischen Dokuments",
                },
                { status: 403 }
            );
        }

        const versions = await db
            .collection("documentVersions")
            .find({ documentId: new ObjectId(documentId) })
            .sort({ versionNumber: -1 }) // Neueste zuerst
            .toArray();

        // Optional: Uploader-Informationen anreichern
        let uploaderName = "Unbekannt";
        if (document.uploaderId) {
            try {
                const uploader = await db
                    .collection("users")
                    .findOne({ _id: new ObjectId(document.uploaderId) });
                if (uploader) {
                    uploaderName = uploader.name || uploader.email || "Unbekannt";
                }
            } catch (e) {
                console.warn("Konnte Uploader-Details nicht laden:", e)
            }
        }

        let statusChangedByName = "N/A";
        if (document.statusChangedBy) {
            try {
                const statusChanger = await db
                    .collection("users")
                    .findOne({ _id: new ObjectId(document.statusChangedBy) });
                if (statusChanger) {
                    statusChangedByName = statusChanger.name || statusChanger.email || "Unbekannt";
                }
            } catch (e) {
                console.warn("Konnte statusChangedBy Benutzerdetails nicht laden:", e);
            }
        }
        
        const populatedDocument = {
            ...document,
            uploaderName,
            versions,
            statusChangedByName,
        };

        return NextResponse.json(populatedDocument, { status: 200 });
    } catch (error) {
        console.error("Fehler beim Abrufen des Dokuments:", error);
        return NextResponse.json(
            { message: "Fehler beim Abrufen des Dokuments" },
            { status: 500 }
        );
    }
} 