"use client";

import { useAuth } from "../auth/auth-provider";
import { useRealtimeItems } from "./use-realtime-items";
import { useRealtimeProjects } from "./use-realtime-projects";

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useRealtimeItems(user?.id);
  useRealtimeProjects(user?.id);

  return <>{children}</>;
}
