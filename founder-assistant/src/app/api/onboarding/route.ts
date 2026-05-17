import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const OnboardingSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  role: z.string().optional(),
  companySize: z.string().optional(),
  industry: z.string().optional(),
  topPriorities: z.array(z.string()).max(3).optional(),
  priorityDomains: z.array(z.string()).optional(),
  checkInFrequency: z.string().optional(),
  briefingTone: z.string().optional(),
  workHoursStart: z.string().optional(),
  workHoursEnd: z.string().optional(),
  assistantName: z.string().min(1).max(30).optional(),
  assistantPersonality: z.enum(["CALM_PROFESSIONAL", "WARM_SUPPORTIVE", "DIRECT_EFFICIENT", "ENERGETIC"]).optional(),
  avatarStyle: z.enum(["PROFESSIONAL", "FRIENDLY", "MINIMAL"]).optional(),
  assistantGender: z.enum(["FEMALE", "MALE", "NEUTRAL"]).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  urgencyThreshold: z.number().min(0).max(100).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.userPersonalityProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.json({ success: true, data: null });
  }

  return NextResponse.json({ success: true, data: profile });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[onboarding] Validation failed:", parsed.error.flatten());
    return NextResponse.json({ success: false, error: "Invalid data", detail: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const userId = session.user.id;

  let profile;
  try {
  profile = await db.userPersonalityProfile.upsert({
    where: { userId },
    update: {
      displayName: data.displayName,
      role: data.role,
      companySize: data.companySize,
      industry: data.industry,
      topPriorities: data.topPriorities ?? [],
      priorityDomains: data.priorityDomains ?? [],
      checkInFrequency: data.checkInFrequency ?? "daily",
      briefingTone: data.briefingTone ?? "concise",
      workHoursStart: data.workHoursStart ?? "08:00",
      workHoursEnd: data.workHoursEnd ?? "19:00",
      assistantName: data.assistantName ?? "Aria",
      assistantPersonality: data.assistantPersonality ?? "CALM_PROFESSIONAL",
      avatarStyle: data.avatarStyle ?? "PROFESSIONAL",
      assistantGender: data.assistantGender ?? "FEMALE",
      avatarColor: data.avatarColor ?? "#f59e0b",
      urgencyThreshold: data.urgencyThreshold ?? 75,
      onboardingComplete: true,
      onboardingAnswers: body,
    },
    create: {
      userId,
      displayName: data.displayName,
      role: data.role,
      companySize: data.companySize,
      industry: data.industry,
      topPriorities: data.topPriorities ?? [],
      priorityDomains: data.priorityDomains ?? [],
      checkInFrequency: data.checkInFrequency ?? "daily",
      briefingTone: data.briefingTone ?? "concise",
      workHoursStart: data.workHoursStart ?? "08:00",
      workHoursEnd: data.workHoursEnd ?? "19:00",
      assistantName: data.assistantName ?? "Aria",
      assistantPersonality: data.assistantPersonality ?? "CALM_PROFESSIONAL",
      avatarStyle: data.avatarStyle ?? "PROFESSIONAL",
      assistantGender: data.assistantGender ?? "FEMALE",
      avatarColor: data.avatarColor ?? "#f59e0b",
      urgencyThreshold: data.urgencyThreshold ?? 75,
      onboardingComplete: true,
      onboardingAnswers: body,
    },
  });
  } catch (err: any) {
    console.error("[onboarding] DB upsert failed:", err);
    return NextResponse.json({ success: false, error: err?.message ?? "Database error" }, { status: 500 });
  }

  // Store top priorities as memory facts
  if (data.topPriorities?.length) {
    await Promise.allSettled(
      data.topPriorities.map((p: string) =>
        db.memoryFact.upsert({
          where: {
            // use a synthetic unique check
            id: `onboard-priority-${userId}-${p.slice(0, 10)}`,
          },
          update: { value: p, isActive: true },
          create: {
            userId,
            type: "PRIORITY",
            key: "work_priority",
            value: p,
            confidence: 1.0,
            source: "onboarding",
          },
        }).catch(() =>
          db.memoryFact.create({
            data: {
              userId,
              type: "PRIORITY",
              key: "work_priority",
              value: p,
              confidence: 1.0,
              source: "onboarding",
            },
          })
        )
      )
    );
  }

  return NextResponse.json({ success: true, data: profile });
}
