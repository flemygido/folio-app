import { SessionProvider } from "@/components/session-provider";
import { TransparentBody } from "./transparent-body";

export const dynamic = "force-dynamic";

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TransparentBody />
      {children}
    </SessionProvider>
  );
}
