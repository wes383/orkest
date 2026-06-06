"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex w-full rounded-3xl border border-black/8 bg-white px-4 py-3 text-[15px] leading-7 outline-none transition-colors placeholder:text-[#9f99a3] disabled:cursor-not-allowed disabled:bg-black/3 focus:border-black/22 dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5] dark:placeholder:text-[#737373] dark:disabled:bg-white/5 dark:focus:border-white/25",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };
