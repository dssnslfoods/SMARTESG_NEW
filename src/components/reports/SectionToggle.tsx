import { Eye, EyeOff, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { ReportSection } from "@/hooks/useReportSections";

interface SectionToggleProps {
  sections: ReportSection[];
  onToggle: (sectionId: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export function SectionToggle({ sections, onToggle, onShowAll, onHideAll }: SectionToggleProps) {
  const { language } = useLanguage();
  const visibleCount = sections.filter(s => s.visible).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">
            {language === "th" ? "จัดการ Card" : "Manage Cards"}
          </span>
          <span className="text-xs text-muted-foreground">
            ({visibleCount}/{sections.length})
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          {language === "th" ? "เลือกแสดง/ซ่อน Card" : "Show/Hide Cards"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {sections.map((section) => (
          <DropdownMenuCheckboxItem
            key={section.id}
            checked={section.visible}
            onCheckedChange={() => onToggle(section.id)}
          >
            {language === "th" ? section.labelTh : section.labelEn}
          </DropdownMenuCheckboxItem>
        ))}
        
        <DropdownMenuSeparator />
        <div className="flex gap-1 p-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-1 text-xs"
            onClick={onShowAll}
          >
            <Eye className="h-3 w-3" />
            {language === "th" ? "แสดงทั้งหมด" : "Show All"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-1 text-xs"
            onClick={onHideAll}
          >
            <EyeOff className="h-3 w-3" />
            {language === "th" ? "ซ่อนทั้งหมด" : "Hide All"}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
