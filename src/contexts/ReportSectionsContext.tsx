import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ReportSection {
  id: string;
  labelTh: string;
  labelEn: string;
  visible: boolean;
}

const DEFAULT_SECTIONS: ReportSection[] = [
  { id: "summary", labelTh: "สรุปภาพรวม", labelEn: "Executive Summary", visible: true },
  { id: "dimensions", labelTh: "มิติ ESG", labelEn: "ESG Dimensions", visible: true },
  { id: "trend", labelTh: "กราฟแนวโน้ม", labelEn: "Trend Chart", visible: true },
  { id: "themes", labelTh: "แนวโน้มหัวข้อ", labelEn: "Theme Trends", visible: true },
  { id: "top-data", labelTh: "หัวข้อ & ตัวชี้วัด", labelEn: "Themes & Metrics", visible: true },
  { id: "sites", labelTh: "สถานที่", labelEn: "Site Performance", visible: true },
  { id: "comparison", labelTh: "เปรียบเทียบมิติ", labelEn: "Dimension Comparison", visible: true },
];

const STORAGE_KEY = 'esg-report-sections';

interface ReportSectionsContextValue {
  sections: ReportSection[];
  toggleSection: (sectionId: string) => void;
  setAllVisible: (visible: boolean) => void;
  isSectionVisible: (sectionId: string) => boolean;
}

const ReportSectionsContext = createContext<ReportSectionsContextValue | null>(null);

export function ReportSectionsProvider({ children }: { children: ReactNode }) {
  const [sections, setSections] = useState<ReportSection[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new sections
        return DEFAULT_SECTIONS.map(def => {
          const saved = parsed.find((s: ReportSection) => s.id === def.id);
          return saved ? { ...def, visible: saved.visible } : def;
        });
      } catch {
        return DEFAULT_SECTIONS;
      }
    }
    return DEFAULT_SECTIONS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  }, [sections]);

  const toggleSection = (sectionId: string) => {
    setSections(prev => 
      prev.map(s => s.id === sectionId ? { ...s, visible: !s.visible } : s)
    );
  };

  const setAllVisible = (visible: boolean) => {
    setSections(prev => prev.map(s => ({ ...s, visible })));
  };

  const isSectionVisible = (sectionId: string) => {
    return sections.find(s => s.id === sectionId)?.visible ?? true;
  };

  return (
    <ReportSectionsContext.Provider value={{ sections, toggleSection, setAllVisible, isSectionVisible }}>
      {children}
    </ReportSectionsContext.Provider>
  );
}

export function useReportSections() {
  const context = useContext(ReportSectionsContext);
  if (!context) {
    throw new Error('useReportSections must be used within a ReportSectionsProvider');
  }
  return context;
}
