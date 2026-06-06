import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SidebarLayout } from "../ui/sidebar-layout";
import { AiChatProvider } from "@/lib/contexts/ai-chat-context";
import {
  parseSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_COOKIE,
} from "@/lib/sidebar-preferences";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialSidebarCollapsed = parseSidebarCollapsedPreference(
    cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value,
  );

  return (
    <AiChatProvider>
      <SidebarLayout initialSidebarCollapsed={initialSidebarCollapsed}>
        {children}
      </SidebarLayout>
    </AiChatProvider>
  );
}
