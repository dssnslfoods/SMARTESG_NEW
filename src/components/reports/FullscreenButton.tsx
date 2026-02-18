import { useCallback, useEffect, useState } from "react";
import { Minimize2, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FullscreenButtonProps {
  targetRef: React.RefObject<HTMLElement>;
  language?: string;
}

export function useFullscreen(targetRef: React.RefObject<HTMLElement>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggle = useCallback(async () => {
    if (!document.fullscreenElement) {
      const el = targetRef.current;
      if (el) {
        await el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
      }
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, [targetRef]);

  return { isFullscreen, toggle };
}

export function FullscreenButton({ targetRef, language = "en" }: FullscreenButtonProps) {
  const { isFullscreen, toggle } = useFullscreen(targetRef);
  const label = isFullscreen
    ? language === "th" ? "ออกจาก TV View" : "Exit TV View"
    : language === "th" ? "TV / Fullscreen View" : "TV / Fullscreen View";

  return (
    <>
      {/* Fullscreen styles injected globally */}
      <style>{`
        :fullscreen [data-fullscreen-content],
        :-webkit-full-screen [data-fullscreen-content] {
          overflow-y: auto;
          height: 100vh;
          padding: 2rem;
          background: white;
        }
      `}</style>
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
