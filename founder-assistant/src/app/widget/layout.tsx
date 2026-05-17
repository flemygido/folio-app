import { SessionProvider } from "@/components/session-provider";

export const dynamic = "force-dynamic";

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
