import { useCallback, useEffect, useState } from "react";
import { Minimize2, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TV_MODE_KEY = "esg_tv_mode";

interface FullscreenButtonProps {
  targetRef: React.RefObject<HTMLElement>;
  language?: string;
  isFullscreen: boolean;
  toggle: () => void;
}

export function useFullscreen(targetRef: React.RefObject<HTMLElement>) {
  // isTVMode = logical "TV mode" (persisted in sessionStorage)
  const [isTVMode, setIsTVMode] = useState(() => sessionStorage.getItem(TV_MODE_KEY) === "1");
  // isFullscreen = actual browser fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync browser fullscreen changes
  useEffect(() => {
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      // If user pressed Escape to exit, clear TV mode too
      if (!fs) {
        setIsTVMode(false);
        sessionStorage.removeItem(TV_MODE_KEY);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Auto-enter fullscreen when page loads and TV mode was active
  useEffect(() => {
    if (isTVMode && !document.fullscreenElement && targetRef.current) {
      targetRef.current.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    }
  }, [isTVMode, targetRef]);

  const toggle = useCallback(async () => {
    if (!document.fullscreenElement) {
      const el = targetRef.current;
      if (el) {
        await el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
        setIsTVMode(true);
        sessionStorage.setItem(TV_MODE_KEY, "1");
      }
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsTVMode(false);
      sessionStorage.removeItem(TV_MODE_KEY);
    }
  }, [targetRef]);

  // Expose isTVMode as the "isFullscreen" flag so TV layout stays consistent
  return { isFullscreen: isTVMode, toggle };
}

export function FullscreenButton({ targetRef, language = "en", isFullscreen, toggle }: FullscreenButtonProps) {
  const label = isFullscreen
    ? language === "th" ? "ออกจาก TV View" : "Exit TV View"
    : language === "th" ? "TV / Fullscreen View" : "TV / Fullscreen View";

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={toggle}
              className="gap-2 h-9 rounded-xl"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">{language === "th" ? "ออก" : "Exit"}</span>
                </>
              ) : (
                <>
                  <Tv2 className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">{language === "th" ? "TV View" : "TV View"}</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="rounded-xl text-xs">
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}

