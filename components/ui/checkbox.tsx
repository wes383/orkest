"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-black/18 bg-white outline-none transition-colors focus:border-black/22 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[#25242a] data-[state=checked]:bg-[#25242a] dark:border-white/20 dark:bg-[#202020] dark:focus:border-white/30 dark:data-[state=checked]:border-[#f5f5f5] dark:data-[state=checked]:bg-[#f5f5f5]",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white dark:text-white">
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
