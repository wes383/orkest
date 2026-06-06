"use client";

import { useEffect } from "react";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useAuth } from "@/lib/auth/auth-provider";

export default function TrashPage() {
  const { user } = useAuth();
  const isLoaded = useAllPageStore((s) => s.isLoaded);
  const loadItemsFromCloud = useAllPageStore((s) => s.loadItemsFromCloud);

  useEffect(() => {
    if (!isLoaded && user) {
      void loadItemsFromCloud(user.id);
    }
  }, [isLoaded, loadItemsFromCloud, user]);

  return null;
}
