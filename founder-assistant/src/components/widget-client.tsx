"use client";

import dynamic from "next/dynamic";

const WidgetLoader = dynamic(
  () => import("@/components/assistant-widget/widget-loader").then((m) => m.WidgetLoader),
  { ssr: false }
);

export function WidgetClient() {
  return <WidgetLoader />;
}
