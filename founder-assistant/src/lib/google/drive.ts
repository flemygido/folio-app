import { google } from "googleapis";
import { getGmailClient } from "./gmail";
import { db } from "@/lib/db";

export async function syncDriveActivity(userId: string, pageToken?: string) {
  const auth = await getGmailClient(userId);
  const drive = google.drive({ version: "v3", auth });

  const oneDayAgo = new Date(Date.now() - 86400_000).toISOString();

  const res = await drive.files.list({
    pageToken: pageToken ?? undefined,
    q: pageToken ? undefined : `modifiedTime > '${oneDayAgo}'`,
    fields: "nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime, modifiedByMeTime, owners, lastModifyingUser)",
    orderBy: "modifiedTime desc",
    pageSize: 50,
  });

  const newPageToken = res.data.nextPageToken ?? undefined;
  const files = res.data.files ?? [];

  await Promise.allSettled(
    files.map((f) =>
      db.driveFile.upsert({
        where: { googleFileId: f.id! },
        update: {
          name: f.name!,
          mimeType: f.mimeType!,
          webViewLink: f.webViewLink ?? null,
          modifiedAt: new Date(f.modifiedTime!),
          modifiedByMe: Boolean(f.modifiedByMeTime),
          owners: (f.owners ?? undefined) as any,
          lastModifyingUser: (f.lastModifyingUser ?? undefined) as any,
        },
        create: {
          userId,
          googleFileId: f.id!,
          name: f.name!,
          mimeType: f.mimeType ?? "application/octet-stream",
          webViewLink: f.webViewLink ?? null,
          modifiedAt: new Date(f.modifiedTime!),
          modifiedByMe: Boolean(f.modifiedByMeTime),
          owners: (f.owners ?? undefined) as any,
          lastModifyingUser: (f.lastModifyingUser ?? undefined) as any,
        },
      })
    )
  );

  return { synced: files.length, newPageToken };
}
