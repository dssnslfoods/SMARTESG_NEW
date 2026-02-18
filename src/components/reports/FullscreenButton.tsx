import { useCallback } from "react";
import { Minimize2, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTVMode } from "@/contexts/TVModeContext";

export { useTVMode };

interface FullscreenButtonProps {
  language?: string;
  isFullscreen: boolean;
  toggle: () => void;
}

/** Thin hook so each page can just do: const { isFullscreen, toggle } = useFullscreen(); */
export function useFullscreen(_ref?: React.RefObject<HTMLElement>) {
  const { isTVMode, toggle } = useTVMode();
  return { isFullscreen: isTVMode, toggle };
}

export function FullscreenButton({ language = "en", isFullscreen, toggle }: FullscreenButtonProps) {
  const label = isFullscreen
    ? language === "th" ? "ออกจาก TV View" : "Exit TV View"
    : language === "th" ? "TV / Fullscreen View" : "TV / Fullscreen View";

  return (
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
                <span className="hidden sm:inline text-xs">TV View</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="rounded-xl text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
