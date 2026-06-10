"use client";

import { cn } from "@/lib/utils";

function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.08]",
        className,
      )}
    />
  );
}

function SkeletonLines({
  lines,
  className,
}: {
  lines: string[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {lines.map((lineClassName, index) => (
        <Skeleton key={index} className={cn("h-4 rounded-full", lineClassName)} />
      ))}
    </div>
  );
}



function TimelineHourSkeleton({
  top,
}: {
  top: number;
}) {
  return (
    <div
      className="absolute left-0 right-0 flex items-start"
      style={{ top: `${top}px`, height: "48px" }}
    >
      <Skeleton className="h-3 w-10 rounded-full" />
      <div className="ml-4 h-px flex-1 bg-black/6 dark:bg-white/10" />
    </div>
  );
}

function TimelineTaskSkeleton({
  top,
  left,
  width,
  height,
}: {
  top: number;
  left: string;
  width: string;
  height: number;
}) {
  return (
    <div
      className="absolute overflow-hidden rounded-xl border border-black/8 bg-white/70 px-3.5 py-3 dark:border-white/10 dark:bg-[#181818]"
      style={{ top: `${top}px`, left, width, height: `${height}px` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Skeleton className="h-5 w-1 rounded-full" />
          <Skeleton className="h-4 flex-1 rounded-full" />
        </div>
        <Skeleton className="h-3 w-18 rounded-full" />
      </div>
    </div>
  );
}

function AllTimelineSectionSkeleton() {
  return (
    <section className="border-t border-black/6 pt-10 first:border-t-0 first:pt-0 dark:border-white/10">
      <div className="space-y-14">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="space-y-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-4 w-8 rounded-full" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, cardIndex) => (
                <div
                  key={cardIndex}
                  className="rounded-[24px] border border-black/6 bg-white/75 p-5 dark:border-white/10 dark:bg-[#181818]"
                >
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-36 rounded-full" />
                    <Skeleton className="h-5 w-2/3 rounded-full" />
                    <Skeleton className="h-4 w-1/2 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DailyDigestSkeleton() {
  return (
    <div className="rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
      <Skeleton className="h-7 w-48 rounded-full" />
      <div className="mt-5 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-black/8 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-[#202020]/75"
          >
            <Skeleton className="h-3 w-14 rounded-full" />
            <Skeleton className="mt-1 h-7 w-10 rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-black/6 pt-4 dark:border-white/10">
        <Skeleton className="h-4 w-full rounded-full" />
      </div>
    </div>
  );
}

export function TodayPageSkeleton() {
  return (
    <section className="relative min-h-screen bg-[#fcfbfa] px-8 py-8 text-[#2b2a30] transition-[padding] duration-300 ease-in-out sm:px-14 lg:px-14 lg:py-12 group-data-[sidebar-collapsed=true]/sidebar:lg:pl-32 group-data-[sidebar-collapsed=true]/sidebar:lg:pr-24 dark:bg-[#101010] dark:text-[#d4d4d4]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#fcfbfa] via-[#fcfbfa]/70 to-[#fcfbfa]/0 dark:from-[#101010] dark:via-[#101010]/70 dark:to-[#101010]/0 sm:hidden"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 lg:gap-10">
        <header className="flex items-end justify-between border-b border-black/6 pb-6">
          <Skeleton className="h-12 w-34 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </header>

        <div className="flex justify-center lg:justify-start px-2 lg:px-3">
          <Skeleton className="h-8 w-40 rounded-full" />
        </div>

        <div className="flex flex-col gap-6">
          <DailyDigestSkeleton />
          <Skeleton className="mx-auto h-3 w-48 rounded-full" />
        </div>
      </div>
    </section>
  );
}

export function AllPageSkeleton() {
  return (
    <section className="min-h-screen bg-[#fcfbfa] px-8 py-8 text-[#2b2a30] transition-[padding] duration-300 ease-in-out sm:px-14 lg:py-12 lg:pr-14 lg:pl-14 group-data-[sidebar-collapsed=true]/sidebar:lg:pr-24 group-data-[sidebar-collapsed=true]/sidebar:lg:pl-32 dark:bg-[#101010] dark:text-[#d4d4d4]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-18">
        <header className="grid gap-4 border-b border-black/6 pb-6 dark:border-white/10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div className="max-w-4xl">
            <Skeleton className="h-12 w-28 rounded-full" />
          </div>
        </header>

        <div className="-mt-8 mb-[-3.5rem] flex flex-col gap-7 lg:mb-0 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:gap-y-4 px-2 lg:px-3">
          <div className="flex items-center justify-center gap-3 lg:justify-start">
            <div className="relative grid grid-cols-4 rounded-full border border-black/8 dark:border-white/10 bg-[#f4f0ec]/[0.5] dark:bg-[#2a2a2a] p-0.5 shrink-0">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-7 w-16 rounded-full" />
              ))}
            </div>
          </div>
          <div className="flex justify-center gap-2 lg:justify-end shrink-0">
            <Skeleton className="h-9 w-12 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
        </div>

        <div className="space-y-20">
          <AllTimelineSectionSkeleton />
          <AllTimelineSectionSkeleton />
        </div>
      </div>
    </section>
  );
}

export function FocusPageSkeleton() {
  return (
    <section className="relative min-h-screen bg-[#fcfbfa] px-8 py-8 text-[#2b2a30] sm:px-14 lg:px-14 lg:py-12 dark:bg-[#101010] dark:text-[#d4d4d4]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#fcfbfa] via-[#fcfbfa]/70 to-[#fcfbfa]/0 dark:from-[#101010] dark:via-[#101010]/70 dark:to-[#101010]/0 sm:hidden"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 lg:gap-10" style={{ minHeight: "calc(100vh - 4rem)" }}>
        <header className="border-b border-black/6 pb-6 dark:border-white/10">
          <Skeleton className="h-12 w-32 rounded-full" />
        </header>

        <div className="flex w-full flex-1 flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center lg:gap-40">
          <div className="flex flex-1 flex-col items-center gap-8 lg:justify-center">
            <div className="inline-flex items-center">
              <Skeleton className="h-8 w-26 rounded-full" />
              <Skeleton className="h-8 w-26 rounded-full" />
            </div>

            <div className="flex h-48 w-full max-w-[28rem] items-center justify-center rounded-3xl border border-black/[0.08] dark:border-white/10">
              <Skeleton className="h-20 w-64 rounded-full" />
            </div>

            <div className="flex items-center gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-7 w-12 rounded-full" />
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-24 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-full" />
            </div>
          </div>

          <div className="flex w-full flex-col gap-6 sm:w-96 lg:pt-10">
            <Skeleton className="h-14 w-full rounded-2xl" />
            <div className="rounded-xl border border-black/6 bg-white/40 p-5 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-3">
                    <Skeleton className="h-4 w-28 rounded-full" />
                    <Skeleton className="h-6 w-4/5 rounded-full" />
                  </div>
                  <div className="flex gap-1">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
                <SkeletonLines lines={["w-full", "w-[88%]"]} />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded-full" />
                  <Skeleton className="h-4 w-2/3 rounded-full" />
                  <Skeleton className="h-4 w-4/5 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-18 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TrashPageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-10 w-40 rounded-full" />
          <Skeleton className="h-4 w-72 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/8 bg-white/75 dark:border-white/10 dark:bg-[#202020]">
        <div className="flex items-center gap-4 border-b border-black/6 bg-[#fcfbfa] px-4 py-3 dark:border-white/10 dark:bg-[#181818]">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 flex-1 rounded-full" />
          <Skeleton className="h-4 w-40 rounded-full" />
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>

        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-black/4 px-4 py-3 last:border-0 dark:border-white/5"
          >
            <Skeleton className="h-4 w-4 rounded" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 rounded-full" />
              <Skeleton className="h-3 w-1/2 rounded-full" />
            </div>
            <Skeleton className="h-4 w-40 rounded-full" />
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-full" />
            <div className="flex w-20 justify-end gap-1">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 dark:text-[#f5f5f5]">
      <div className="mb-6">
        <Skeleton className="h-10 w-44 rounded-full" />
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-4 w-40 rounded-full" />
              <Skeleton className="h-4 w-56 rounded-full" />
            </div>
          </div>
        </div>

        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-40 rounded-full" />
              </div>
              <Skeleton className="h-4 w-72 rounded-full" />
              <Skeleton className="h-12 w-full rounded-[20px]" />
            </div>
          </div>
        ))}

        <div className="rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
