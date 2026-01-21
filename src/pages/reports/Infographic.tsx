import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Printer, 
  Download,
  Factory,
  Users,
  Zap,
  BookOpen,
  Droplets,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Leaf,
  Heart,
  Shield
} from "lucide-react";

// Mock data - in production, fetch from database
const mockData = {
  overallScore: 75,
  environmentalScore: 68,
  socialScore: 78,
  governanceScore: 74,
  metrics: {
    emissions: { value: 12450, unit: "tCO₂e" },
    employees: { value: 2340, unit: "" },
    renewable: { value: 45, unit: "%" },
    training: { value: 24, unit: "" },
    waterReduction: { value: 15, unit: "%" },
    compliance: { value: 98, unit: "%" },
  },
  achievements: [
    { th: "ลดการปล่อยก๊าซเรือนกระจก 12% YoY", en: "Reduced carbon emissions by 12% YoY" },
    { th: "ได้รับการรับรอง ISO 14001", en: "Achieved ISO 14001 certification" },
    { th: "ไม่มีอุบัติเหตุในที่ทำงาน 180 วัน", en: "Zero workplace accidents for 180 days" },
    { th: "ประเมิน ESG ผู้จัดหา 100%", en: "100% supplier ESG assessment completed" },
  ],
  focusAreas: [
    { th: "เพิ่มพลังงานหมุนเวียนเป็น 60%", en: "Expand renewable energy to 60%" },
    { th: "ลดการใช้น้ำ 20%", en: "Reduce water consumption by 20%" },
    { th: "เพิ่มอัตราส่วนความหลากหลายเป็น 40%", en: "Increase diversity ratio to 40%" },
    { th: "ดำเนินโครงการเศรษฐกิจหมุนเวียน", en: "Implement circular economy initiatives" },
  ],
  reportYear: 2025,
};

const ScoreCircle = ({ score, size = "large" }: { score: number; size?: "large" | "small" }) => {
  const radius = size === "large" ? 70 : 35;
  const strokeWidth = size === "large" ? 10 : 6;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const viewBoxSize = (radius + strokeWidth) * 2;
  const center = radius + strokeWidth;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "hsl(var(--chart-2))";
    if (score >= 60) return "hsl(var(--chart-1))";
    if (score >= 40) return "hsl(var(--chart-3))";
    return "hsl(var(--destructive))";
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={viewBoxSize}
        height={viewBoxSize}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="transform -rotate-90"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getScoreColor(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-bold text-foreground ${size === "large" ? "text-4xl" : "text-lg"}`}>
          {score}
        </span>
      </div>
    </div>
  );
};

const DimensionScore = ({ 
  label, 
  score, 
  icon: Icon,
  color 
}: { 
  label: string; 
  score: number; 
  icon: React.ElementType;
  color: string;
}) => (
  <div className="flex flex-col items-center gap-2 p-4">
    <div className={`p-2 rounded-full ${color}`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
    <span className="text-2xl font-bold text-foreground">{score}</span>
    <Progress value={score} className="w-full h-2" />
  </div>
);

const MetricCard = ({ 
  icon: Icon, 
  value, 
  unit, 
  label,
  iconBg
}: { 
  icon: React.ElementType; 
  value: number | string; 
  unit: string; 
  label: string;
  iconBg: string;
}) => (
  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg print:bg-gray-50">
    <div className={`p-2 rounded-lg ${iconBg}`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div className="flex flex-col">
      <span className="text-lg font-bold text-foreground">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  </div>
);

const Infographic = () => {
  const { language } = useLanguage();

  const labels = {
    pageTitle: language === 'th' ? 'สรุปผู้บริหาร' : 'Executive Infographic',
    pageSubtitle: language === 'th' ? 'รายงานสรุปสำหรับพิมพ์' : 'Print-ready executive summary',
    print: language === 'th' ? 'พิมพ์' : 'Print',
    downloadPdf: language === 'th' ? 'ดาวน์โหลด PDF' : 'Download PDF',
    reportTitle: language === 'th' ? 'รายงานผลการดำเนินงาน ESG' : 'ESG Performance Report',
    fiscalYear: language === 'th' ? 'ปีงบประมาณ' : 'Fiscal Year',
    generatedOn: language === 'th' ? 'สร้างเมื่อ' : 'Generated on',
    overallScore: language === 'th' ? 'คะแนน ESG รวม' : 'Overall ESG Score',
    excellent: language === 'th' ? 'ดีเยี่ยม' : 'Excellent',
    good: language === 'th' ? 'ดี' : 'Good',
    fair: language === 'th' ? 'พอใช้' : 'Fair',
    needsImprovement: language === 'th' ? 'ต้องปรับปรุง' : 'Needs Improvement',
    environmental: language === 'th' ? 'สิ่งแวดล้อม' : 'Environmental',
    social: language === 'th' ? 'สังคม' : 'Social',
    governance: language === 'th' ? 'ธรรมาภิบาล' : 'Governance',
    ghgEmissions: language === 'th' ? 'การปล่อย GHG' : 'GHG Emissions',
    employees: language === 'th' ? 'พนักงาน' : 'Employees',
    renewableEnergy: language === 'th' ? 'พลังงานหมุนเวียน' : 'Renewable Energy',
    avgTraining: language === 'th' ? 'ชม.อบรม/คน' : 'Avg Training (hrs)',
    waterReduction: language === 'th' ? 'ลดใช้น้ำ' : 'Water Reduction',
    complianceRate: language === 'th' ? 'อัตราปฏิบัติตาม' : 'Compliance Rate',
    keyAchievements: language === 'th' ? 'ผลสำเร็จสำคัญ' : 'Key Achievements',
    focusAreas: language === 'th' ? 'ประเด็นเน้น' : 'Focus Areas',
    allRightsReserved: language === 'th' ? 'สงวนลิขสิทธิ์' : 'All Rights Reserved',
    confidential: language === 'th' ? 'เอกสารลับ' : 'Confidential Document',
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    window.print();
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return labels.excellent;
    if (score >= 60) return labels.good;
    if (score >= 40) return labels.fair;
    return labels.needsImprovement;
  };

  return (
    <MainLayout>
      <div className="space-y-4 print:space-y-0">
        {/* Print Controls - hidden when printing */}
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{labels.pageTitle}</h1>
            <p className="text-muted-foreground">{labels.pageSubtitle}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              {labels.print}
            </Button>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              {labels.downloadPdf}
            </Button>
          </div>
        </div>

        {/* Infographic Container - A4 aspect ratio */}
        <Card className="w-full max-w-[210mm] mx-auto bg-card shadow-lg print:shadow-none print:border-none overflow-hidden">
          {/* A4 Print Wrapper */}
          <div className="p-6 print:p-8 space-y-6 print:space-y-4" style={{ minHeight: '297mm' }}>
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
                  <Leaf className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">{labels.reportTitle}</h1>
                  <p className="text-sm text-muted-foreground">
                    {labels.fiscalYear} {mockData.reportYear}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{labels.generatedOn}</p>
                <p className="text-sm font-medium text-foreground">
                  {new Date().toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>

            {/* Overall Score Section */}
            <div className="flex flex-col items-center py-6 bg-muted/20 rounded-xl print:bg-gray-50">
              <p className="text-sm text-muted-foreground mb-2">{labels.overallScore}</p>
              <ScoreCircle score={mockData.overallScore} size="large" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                {getScoreLabel(mockData.overallScore)}
              </p>
            </div>

            {/* Dimension Scores */}
            <div className="grid grid-cols-3 gap-4 border-y border-border py-4">
              <DimensionScore 
                label={labels.environmental}
                score={mockData.environmentalScore}
                icon={Leaf}
                color="bg-emerald-500"
              />
              <DimensionScore 
                label={labels.social}
                score={mockData.socialScore}
                icon={Heart}
                color="bg-blue-500"
              />
              <DimensionScore 
                label={labels.governance}
                score={mockData.governanceScore}
                icon={Shield}
                color="bg-purple-500"
              />
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard 
                icon={Factory}
                value={mockData.metrics.emissions.value}
                unit={mockData.metrics.emissions.unit}
                label={labels.ghgEmissions}
                iconBg="bg-orange-500"
              />
              <MetricCard 
                icon={Users}
                value={mockData.metrics.employees.value}
                unit=""
                label={labels.employees}
                iconBg="bg-blue-500"
              />
              <MetricCard 
                icon={Zap}
                value={mockData.metrics.renewable.value}
                unit="%"
                label={labels.renewableEnergy}
                iconBg="bg-yellow-500"
              />
              <MetricCard 
                icon={BookOpen}
                value={mockData.metrics.training.value}
                unit=""
                label={labels.avgTraining}
                iconBg="bg-indigo-500"
              />
              <MetricCard 
                icon={Droplets}
                value={`-${mockData.metrics.waterReduction.value}`}
                unit="%"
                label={labels.waterReduction}
                iconBg="bg-cyan-500"
              />
              <MetricCard 
                icon={CheckCircle}
                value={mockData.metrics.compliance.value}
                unit="%"
                label={labels.complianceRate}
                iconBg="bg-green-500"
              />
            </div>

            {/* Achievements and Focus Areas */}
            <div className="grid grid-cols-2 gap-6 pt-4">
              {/* Key Achievements */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <h3 className="font-semibold text-foreground">{labels.keyAchievements}</h3>
                </div>
                <ul className="space-y-2">
                  {mockData.achievements.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                      <span>{language === 'th' ? item.th : item.en}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Focus Areas */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-amber-500" />
                  <h3 className="font-semibold text-foreground">{labels.focusAreas}</h3>
                </div>
                <ul className="space-y-2">
                  {mockData.focusAreas.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                      <span>{language === 'th' ? item.th : item.en}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-6 border-t border-border flex items-center justify-between text-xs text-muted-foreground print:fixed print:bottom-8 print:left-8 print:right-8">
              <span>© {mockData.reportYear} ESG Hub - {labels.allRightsReserved}</span>
              <span>{labels.confidential}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </MainLayout>
  );
};

export default Infographic;
