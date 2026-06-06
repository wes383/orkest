import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isLocale, LOCALES, DEFAULT_LOCALE } from "@/lib/i18n";

const LOCALE_METADATA: Record<string, { title: string; description: string }> = {
  en: {
    title: "Orkest - Task & Time Orchestration App",
    description: "Orkest helps you plan your day, manage tasks, and orchestrate your time with AI-powered scheduling. Stay focused, stay on track.",
  },
  "zh-CN": {
    title: "Orkest - 智能任务与时间管理应用",
    description: "Orkest 帮助您规划每一天，通过 AI 智能调度管理任务，保持专注，高效完成工作。",
  },
  es: {
    title: "Orkest - Aplicación de Gestión de Tareas y Tiempo",
    description: "Orkest te ayuda a planificar tu día, gestionar tareas y organizar tu tiempo con programación impulsada por IA.",
  },
  fr: {
    title: "Orkest - Application de Gestion de Tâches et de Temps",
    description: "Orkest vous aide à planifier votre journée, gérer vos tâches et organiser votre temps avec une planification alimentée par l'IA.",
  },
  de: {
    title: "Orkest - Aufgaben- und Zeitmanagement-App",
    description: "Orkest hilft Ihnen, Ihren Tag zu planen, Aufgaben zu verwalten und Ihre Zeit mit KI-gestützter Planung zu organisieren.",
  },
  ja: {
    title: "Orkest - タスク＆タイムオーケストレーションアプリ",
    description: "OrkestはAIパワードスケジューリングで一日を計画し、タスクを管理し、時間を整理するのに役立ちます。",
  },
  pt: {
    title: "Orkest - Aplicativo de Gestão de Tarefas e Tempo",
    description: "Orkest ajuda você a planejar seu dia, gerenciar tarefas e organizar seu tempo com agendamento alimentado por IA.",
  },
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const meta = LOCALE_METADATA[locale] ?? LOCALE_METADATA[DEFAULT_LOCALE];
  const baseUrl = "https://orkest.wesluma.com";
  const localePath = locale === DEFAULT_LOCALE ? "" : `/${locale}`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${baseUrl}${localePath}`,
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, `${baseUrl}/${l}`]),
      ),
    },
    openGraph: {
      locale,
      alternateLocale: LOCALES.filter((l) => l !== locale),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  return children;
}
