"use client";

/**
 * Widget loader — fetches config + alerts then renders the widget.
 * This is a client component so it can be loaded dynamically (no SSR).
 */

import { useEffect, useState } from "react";
import { AssistantWidget } from "./index";

interface Profile {
  assistantName: string;
  avatarStyle: "PROFESSIONAL" | "FRIENDLY" | "MINIMAL";
  assistantGender: "FEMALE" | "MALE" | "NEUTRAL";
  avatarColor: string;
  assistantPersonality: string;
}

export function WidgetLoader() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/onboarding").then((r) => r.json()).catch(() => null),
      fetch("/api/alerts").then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([profileRes, alertsRes]) => {
      if (profileRes?.data) setProfile(profileRes.data);
      if (alertsRes?.data) setAlerts(alertsRes.data);
      setReady(true);
    });
  }, []);

  if (!ready || !profile?.assistantName) return null;

  return (
    <AssistantWidget
      config={{
        assistantName: profile.assistantName,
        avatarStyle: profile.avatarStyle,
        assistantGender: profile.assistantGender,
        avatarColor: profile.avatarColor,
        personality: profile.assistantPersonality,
      }}
      alerts={alerts}
    />
  );
}
