"use client";

import { useEffect } from "react";

import { useAuth } from "@/lib/auth/auth-provider";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { ProjectsPage } from "@/components/projects/projects-page";

export default function ProjectsRoute() {
  const { user } = useAuth();
  const isLoaded = useAllPageStore((s) => s.isLoaded);
  const loadItemsFromCloud = useAllPageStore((s) => s.loadItemsFromCloud);
  const projectsLoaded = useProjectStore((s) => s.isLoaded);
  const loadProjects = useProjectStore((s) => s.loadProjects);

  useEffect(() => {
    if (!isLoaded && user) {
      void loadItemsFromCloud(user.id);
    }
    if (!projectsLoaded && user) {
      void loadProjects(user.id);
    }
  }, [isLoaded, loadItemsFromCloud, projectsLoaded, loadProjects, user]);

  return <ProjectsPage />;
}
