import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Orkest - Task & Time Orchestration App",
  description:
    "Orkest helps you plan your day, manage tasks, and orchestrate your time with AI-powered scheduling. Stay focused, stay on track.",
  robots: { index: true, follow: true },
};

export default function LandingRoute() {
  return <LandingPage />;
}
