import { useEffect } from "react";
import type { ReadyDetails } from "./types";

export function useReady(onReady: (details: ReadyDetails) => void, details: ReadyDetails): void {
  useEffect(() => {
    let first = 0;
    let second = 0;
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => onReady(details));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [details.horizontalScrollSelector, details.mountedCellSelector, details.scrollSelector, onReady]);
}
