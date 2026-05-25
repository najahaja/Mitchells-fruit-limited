import { useState, useEffect } from "react";
import { BP } from "../styles/breakpoints";

type Bp = { isMobile: boolean; isTablet: boolean; isDesktop: boolean };

function classify(w: number): Bp {
  return { isMobile: w <= BP.mobile, isTablet: w > BP.mobile && w <= BP.tablet, isDesktop: w > BP.tablet };
}

export function useBreakpoint(): Bp {
  const [bp, setBp] = useState<Bp>(() => classify(typeof window !== "undefined" ? window.innerWidth : 1280));
  useEffect(() => {
    const handler = () => setBp(classify(window.innerWidth));
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
}
