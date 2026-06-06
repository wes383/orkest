import { useEffect } from "react";

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      document.body.style.overflow = "";
      document.documentElement.style.scrollbarGutter = "";
      return;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.scrollbarGutter = "auto";

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.scrollbarGutter = "";
    };
  }, [locked]);
}
