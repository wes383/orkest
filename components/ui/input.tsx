"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-12 w-full rounded-2xl border border-black/8 bg-white px-4 text-[15px] outline-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#9f99a3] disabled:cursor-not-allowed disabled:bg-black/3 focus:border-black/22 dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5] dark:placeholder:text-[#737373] dark:disabled:bg-white/5 dark:focus:border-white/25",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
