import { useNavigate, useLocation } from "react-router-dom";
import { Globe, Leaf, Heart, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const REPORT_PAGES = [
  { path: "/reports/esg-overview", labelTh: "ESG Overview", labelEn: "ESG Overview", icon: Globe, color: "from-emerald-500 via-blue-500 to-purple-500" },
  { path: "/reports/environmental", labelTh: "สิ่งแวดล้อม", labelEn: "Environmental", icon: Leaf, color: "from-emerald-500 to-teal-500" },
  { path: "/reports/social", labelTh: "สังคม", labelEn: "Social", icon: Heart, color: "from-blue-500 to-indigo-500" },
  { path: "/reports/governance", labelTh: "ธรรมาภิบาล", labelEn: "Governance", icon: Shield, color: "from-purple-500 to-violet-500" },
];

interface TVNavBarProps {
  language?: string;
}

export function TVNavBar({ language = "en" }: TVNavBarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentIndex = REPORT_PAGES.findIndex(p => location.pathname === p.path);
  const prevPage = currentIndex > 0 ? REPORT_PAGES[currentIndex - 1] : null;
  const nextPage = currentIndex < REPORT_PAGES.length - 1 ? REPORT_PAGES[currentIndex + 1] : null;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Prev button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => prevPage && navigate(prevPage.path)}
        disabled={!prevPage}
        className="h-7 w-7 p-0 rounded-lg disabled:opacity-20"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Page tabs */}
      <div className="flex items-center gap-1">
        {REPORT_PAGES.map((page, idx) => {
          const Icon = page.icon;
          const isActive = idx === currentIndex;
          return (
            <button
              key={page.path}
              onClick={() => navigate(page.path)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200
                ${isActive
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }
              `}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="hidden sm:inline">
                {language === "th" ? page.labelTh : page.labelEn}
              </span>
            </button>
          );
        })}
      </div>

      {/* Next button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => nextPage && navigate(nextPage.path)}
        disabled={!nextPage}
        className="h-7 w-7 p-0 rounded-lg disabled:opacity-20"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
