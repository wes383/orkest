"use client";

import type { LucideIcon } from "lucide-react";

type ActionButton = {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
};

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ActionButton;
  secondaryAction?: ActionButton;
  compact?: boolean;
};

export function EmptyState({ icon: Icon, title, description, action, secondaryAction, compact = false }: EmptyStateProps) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Icon className="mb-3 h-8 w-8 text-[#b0a9b2] dark:text-[#6a6570]" />
        <p className="text-sm font-medium text-[#25242a] dark:text-[#e8e6ea]">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-[#6a6570] dark:text-[#a09ba5]">{description}</p>
        )}
        {(action || secondaryAction) && (
          <div className="mt-3 flex items-center gap-2">
            {action && (
              <button
                type="button"
                onClick={action.onClick}
                className="cursor-pointer rounded-full border border-black/10 bg-[#fafafa] px-4 py-1.5 text-xs font-medium text-[#25242a] transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4] dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
              >
                {action.icon && <action.icon className="mr-1 inline h-3 w-3" />}
                {action.label}
              </button>
            )}
            {secondaryAction && (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="cursor-pointer rounded-full border border-black/10 bg-[#fafafa] px-4 py-1.5 text-xs font-medium text-[#25242a] transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4] dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
              >
                {secondaryAction.icon && <secondaryAction.icon className="mr-1 inline h-3 w-3" />}
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-8 py-10 max-w-md">
        <Icon className="mx-auto h-10 w-10 text-[#b0a9b2] dark:text-[#6a6570] mb-4" />
        <h3 className="font-display text-lg font-semibold text-[#25242a] dark:text-[#e8e6ea]">
          {title}
        </h3>
        {description && (
          <p className="mt-2 text-sm leading-6 text-[#6a6570] dark:text-[#a09ba5]">
            {description}
          </p>
        )}
        {(action || secondaryAction) && (
          <div className="mt-4 flex items-center justify-center gap-3">
            {action && (
              <button
                type="button"
                onClick={action.onClick}
                className="cursor-pointer rounded-full border border-black/10 bg-[#fafafa] px-5 py-2 text-sm font-medium text-[#25242a] transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4] dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
              >
                {action.icon && <action.icon className="mr-1.5 inline h-4 w-4" />}
                {action.label}
              </button>
            )}
            {secondaryAction && (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="cursor-pointer rounded-full border border-black/10 bg-[#fafafa] px-5 py-2 text-sm font-medium text-[#25242a] transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4] dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
              >
                {secondaryAction.icon && <secondaryAction.icon className="mr-1.5 inline h-4 w-4" />}
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
