"use client";

import { useAuth } from "../auth/auth-provider";
import { useRealtimeItems } from "./use-realtime-items";
import { useRealtimeProjects } from "./use-realtime-projects";
import { useRealtimeProgresses } from "./use-realtime-progresses";

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useRealtimeItems(user?.id);
  useRealtimeProjects(user?.id);
  useRealtimeProgresses(user?.id);

  return <>{children}</>;
}
