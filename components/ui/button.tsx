"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon" | "fab";
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-[#25242a] text-white hover:bg-black border border-transparent shadow-sm dark:bg-[#f5f5f5] dark:text-[#111111] dark:hover:bg-white",
  outline:
    "border border-black/[0.08] bg-white text-[#4d4a51] hover:bg-black/[0.03] dark:border-white/10 dark:bg-[#202020] dark:text-[#d4d4d4] dark:hover:bg-white/8",
  ghost: "border border-transparent bg-transparent text-[#6d6770] hover:bg-black/[0.04] hover:text-black dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-10 rounded-full px-5 py-2 text-sm font-medium",
  sm: "h-9 rounded-full px-4 text-sm font-medium",
  icon: "h-10 w-10 rounded-full",
  fab: "h-15 w-15 rounded-full shadow-[0_18px_45px_rgba(37,36,42,0.22)]",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap transition-transform outline-none disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button };
