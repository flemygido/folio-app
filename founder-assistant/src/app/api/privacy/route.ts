import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserDataAudit,
  deleteAllUserData,
  purgeAllEmailBodies,
  revokeGoogleAccess,
} from "@/services/privacy.service";
import { db } from "@/lib/db";

// GET /api/privacy        — data audit
// GET /api/privacy?export=1 — full data export as JSON file
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isExport = req.nextUrl.searchParams.get("export") === "1";

  if (isExport) {
    const userId = session.user.id;
    const [emails, calendarEvents, driveFiles, memoryFacts, tasks, smartAlerts, auditLogs] =
      await Promise.all([
        db.email.findMany({ where: { userId }, select: { gmailMessageId: true, subject: true, fromAddress: true, fromName: true, snippet: true, receivedAt: true, importanceScore: true, category: true, shortSummary: true, actionNeeded: true, dueDate: true, whyImportant: true } }),
        db.calendarEvent.findMany({ where: { userId }, select: { googleEventId: true, title: true, startTime: true, endTime: true, attendees: true, location: true, meetLink: true } }),
        db.driveFile.findMany({ where: { userId }, select: { googleFileId: true, name: true, mimeType: true, modifiedAt: true, webViewLink: true } }),
        db.memoryFact.findMany({ where: { userId }, select: { type: true, key: true, value: true, confidence: true, source: true, createdAt: true } }),
        db.task.findMany({ where: { userId }, select: { title: true, description: true, dueAt: true, priority: true, status: true, source: true, createdAt: true } }),
        db.smartAlert.findMany({ where: { userId }, select: { type: true, title: true, body: true, urgency: true, createdAt: true } }),
        db.auditLog.findMany({ where: { userId }, select: { action: true, detail: true, createdAt: true } }),
      ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      note: "This is a complete export of all data Folio holds about you. Raw email bodies are never stored.",
      emails,
      calendarEvents,
      driveFiles,
      memoryFacts,
      tasks,
      smartAlerts,
      auditLogs,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="folio-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  }

  const audit = await getUserDataAudit(session.user.id);
  return NextResponse.json(audit);
}

// DELETE /api/privacy — full account erasure (GDPR Art. 17)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action } = await req.json().catch(() => ({}));

  // Partial delete: purge email bodies only
  if (action === "purge_bodies") {
    const count = await purgeAllEmailBodies(session.user.id);
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_DATA",
        detail: `Purged ${count} stored email bodies`,
      },
    });
    return NextResponse.json({ success: true, purged: count });
  }

  // Partial delete: revoke Google access
  if (action === "revoke_google") {
    await revokeGoogleAccess(session.user.id);
    return NextResponse.json({ success: true });
  }

  // Full erasure: delete everything
  const result = await deleteAllUserData(session.user.id);
  return NextResponse.json({ success: true, ...result });
}

