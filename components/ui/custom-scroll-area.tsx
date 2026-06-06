"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type CustomScrollAreaProps = React.HTMLAttributes<HTMLDivElement> & {
  viewportClassName?: string;
};

export function CustomScrollArea({
  className,
  viewportClassName,
  children,
  ...props
}: CustomScrollAreaProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const dragStateRef = React.useRef<{ startY: number; startScrollTop: number } | null>(null);
  const [thumbHeight, setThumbHeight] = React.useState(0);
  const [thumbOffset, setThumbOffset] = React.useState(0);
  const [isScrollable, setIsScrollable] = React.useState(false);

  React.useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const updateThumb = () => {
      const { clientHeight, scrollHeight, scrollTop } = viewport;
      const trackHeight = trackRef.current?.clientHeight ?? clientHeight;
      const canScroll = scrollHeight > clientHeight + 1;

      setIsScrollable(canScroll);

      if (!canScroll) {
        setThumbHeight(0);
        setThumbOffset(0);
        return;
      }

      const nextThumbHeight = Math.max((clientHeight / scrollHeight) * trackHeight, 44);
      const maxThumbOffset = trackHeight - nextThumbHeight;
      const maxScrollTop = scrollHeight - clientHeight;
      const nextThumbOffset =
        maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbOffset : 0;

      setThumbHeight(nextThumbHeight);
      setThumbOffset(nextThumbOffset);
    };

    updateThumb();

    const resizeObserver = new ResizeObserver(updateThumb);
    resizeObserver.observe(viewport);

    const mutationObserver = new MutationObserver(updateThumb);
    mutationObserver.observe(viewport, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    viewport.addEventListener("scroll", updateThumb, { passive: true });
    window.addEventListener("resize", updateThumb);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      viewport.removeEventListener("scroll", updateThumb);
      window.removeEventListener("resize", updateThumb);
    };
  }, []);

  React.useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const viewport = viewportRef.current;
      const dragState = dragStateRef.current;

      if (!viewport || !dragState || !isScrollable) {
        return;
      }

      const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
      const trackHeight = trackRef.current?.clientHeight ?? viewport.clientHeight;
      const maxThumbOffset = trackHeight - thumbHeight;

      if (maxScrollTop <= 0 || maxThumbOffset <= 0) {
        return;
      }

      const deltaY = event.clientY - dragState.startY;
      const scrollDelta = (deltaY / maxThumbOffset) * maxScrollTop;
      viewport.scrollTop = dragState.startScrollTop + scrollDelta;
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isScrollable, thumbHeight]);

  return (
    <div className={cn("relative h-full overflow-hidden", className)} {...props}>
      <div
        ref={viewportRef}
        className={cn(
          "scrollbar-hidden h-full overflow-y-auto overflow-x-hidden pr-4",
          viewportClassName,
        )}
      >
        {children}
      </div>

      {isScrollable ? (
        <div
          ref={trackRef}
          className="pointer-events-none absolute top-6 right-2 bottom-6 w-2 rounded-full bg-black/4 dark:bg-white/8"
        >
          <div
            className="pointer-events-auto absolute left-0 w-full rounded-full bg-black/26 transition-colors hover:bg-black/36 active:bg-black/42 dark:bg-white/25 dark:hover:bg-white/35 dark:active:bg-white/45"
            style={{
              height: `${thumbHeight}px`,
              transform: `translateY(${thumbOffset}px)`,
            }}
            onPointerDown={(event) => {
              const viewport = viewportRef.current;

              if (!viewport) {
                return;
              }

              dragStateRef.current = {
                startY: event.clientY,
                startScrollTop: viewport.scrollTop,
              };
              document.body.style.userSelect = "none";
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
