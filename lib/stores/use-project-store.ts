import { create } from "zustand";
import type { Project } from "../types/item";
import { createClient } from "../supabase/client";
import { makeUid } from "../all-page-utils";
import { syncRecord } from "../offline/sync-engine";

interface ProjectStoreState {
  projects: Project[];
  isLoaded: boolean;

  // Actions
  loadProjects: (userId: string) => Promise<void>;
  createProject: (userId: string, name: string, color?: string) => Promise<Project | null>;
  updateProject: (userId: string, projectId: string, updates: { name?: string; color?: string }) => Promise<boolean>;
  deleteProject: (userId: string, projectId: string) => Promise<boolean>;
  findProjectByName: (name: string) => Project | undefined;
  resetStore: () => void;

  // Realtime actions
  applyRemoteProjectChange: (project: Project) => void;
  applyRemoteDelete: (projectId: string) => void;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: [],
  isLoaded: false,

  async loadProjects(userId: string) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .order("name");

      if (error) {
        console.error("Failed to load projects:", error);
        return;
      }

      const projects: Project[] = (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        color: row.color ?? undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));

      set({ projects, isLoaded: true });
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  },

  async createProject(userId: string, name: string, color?: string) {
    const id = makeUid();
    const now = new Date();
    const project: Project = {
      id,
      userId,
      name,
      color,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({ projects: [...state.projects, project] }));

    syncRecord("create", "projects", id, {
      id,
      user_id: userId,
      name,
      color: color ?? null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    return project;
  },

  async updateProject(userId: string, projectId: string, updates: { name?: string; color?: string }) {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, ...updates, updatedAt: new Date() } : p,
      ),
    }));

    syncRecord("update", "projects", projectId, {
      ...updates,
      user_id: userId,
    });

    return true;
  },

  async deleteProject(userId: string, projectId: string) {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
    }));

    syncRecord("delete", "projects", projectId, {
      user_id: userId,
    });

    return true;
  },

  findProjectByName(name: string) {
    const normalized = name.toLowerCase().trim();
    return get().projects.find((p) => p.name.toLowerCase() === normalized);
  },

  resetStore() {
    set({ projects: [], isLoaded: false });
  },

  applyRemoteProjectChange(project) {
    set((state) => {
      const exists = state.projects.some((p) => p.id === project.id);
      if (exists) {
        return {
          projects: state.projects.map((p) =>
            p.id === project.id ? { ...p, ...project } : p
          ),
        };
      }
      return { projects: [...state.projects, project] };
    });
  },

  applyRemoteDelete(projectId) {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
    }));
  },
}));
