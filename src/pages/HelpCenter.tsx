import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  Calculator,
  Shield,
  Users,
  Database,
  FileInput,
  BarChart3,
  Leaf,
  Heart,
  Scale,
  Globe,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Minus,
  AlertTriangle,
  History,
  HardDrive,
} from "lucide-react";

export default function HelpCenter() {
  const { language } = useLanguage();
  const th = language === "th";

  return (
    <>
      <div className="space-y-6 pb-8 bg-gradient-to-br from-background via-background to-primary/5 min-h-screen -m-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            {th ? "ศูนย์ช่วยเหลือ" : "Help Center"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {th
              ? "คู่มือการใช้งานระบบ ESG Performance อย่างครบถ้วน"
              : "Complete user guide for the ESG Performance system"}
          </p>
        </div>

        {/* ─── Section 1: System Overview ─── */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl rounded-2xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg">
              {th ? "ภาพรวมระบบ" : "System Overview"}
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none text-foreground">
            <p className="text-muted-foreground">
              {th
                ? "ระบบ ESG Smart Performance เป็นแพลตฟอร์มจัดการข้อมูลด้านความยั่งยืน ครอบคลุม 3 มิติหลัก ได้แก่ สิ่งแวดล้อม (Environmental), สังคม (Social), และธรรมาภิบาล (Governance) รองรับการบันทึกข้อมูล การรายงาน และการวิเคราะห์แนวโน้ม พร้อมระบบควบคุมสิทธิ์ผู้ใช้งานตามบทบาท"
                : "ESG Smart Performance is a sustainability data management platform covering three dimensions: Environmental, Social, and Governance. It supports data entry, reporting, trend analysis, and role-based access control."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[
                { icon: Leaf, label: th ? "สิ่งแวดล้อม" : "Environmental", desc: th ? "GHG, พลังงาน, น้ำ, ขยะ" : "GHG, Energy, Water, Waste", color: "text-emerald-600" },
                { icon: Heart, label: th ? "สังคม" : "Social", desc: th ? "อบรม, ความปลอดภัย, สุขภาวะ" : "Training, Safety, Well-being", color: "text-blue-600" },
                { icon: Scale, label: th ? "ธรรมาภิบาล" : "Governance", desc: th ? "เหตุการณ์, ทุจริต, ภาษี" : "Incidents, Corruption, Tax", color: "text-purple-600" },
              ].map((d, i) => (
                <div key={i} className="bg-muted/30 rounded-xl p-4 flex items-start gap-3">
                  <d.icon className={`h-5 w-5 mt-0.5 ${d.color}`} />
                  <div>
                    <p className="font-semibold text-sm">{d.label}</p>
                    <p className="text-xs text-muted-foreground">{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ─── Section 2: Roles & Permissions ─── */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl rounded-2xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <CardTitle className="text-lg">
              {th ? "บทบาทและสิทธิ์ผู้ใช้งาน" : "Roles & Permissions"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {th
                ? "ระบบมี 5 บทบาท เรียงตามลำดับสิทธิ์จากสูงไปต่ำ"
                : "The system has 5 roles, ordered from highest to lowest privilege"}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-semibold">{th ? "บทบาท" : "Role"}</th>
                    <th className="text-center py-2 px-3 font-semibold">{th ? "แดชบอร์ด" : "Dashboard"}</th>
                    <th className="text-center py-2 px-3 font-semibold">{th ? "บันทึกข้อมูล" : "Data Entry"}</th>
                    <th className="text-center py-2 px-3 font-semibold">{th ? "รายงาน" : "Reports"}</th>
                    <th className="text-center py-2 px-3 font-semibold">{th ? "ข้อมูลหลัก" : "Master Data"}</th>
                    <th className="text-center py-2 px-3 font-semibold">{th ? "จัดการผู้ใช้" : "User Mgmt"}</th>
                    <th className="text-center py-2 px-3 font-semibold">{th ? "สำรองข้อมูล" : "Backup"}</th>
                    <th className="text-center py-2 px-3 font-semibold">{th ? "Audit Log" : "Audit Log"}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { role: "Admin", roleTh: "ผู้ดูแลระบบ", color: "bg-red-500/10 text-red-700 border-red-500/20", perms: [true, true, true, true, true, true, true] },
                    { role: "Executive", roleTh: "ผู้บริหาร", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", perms: [true, false, true, false, "self", false, false] },
                    { role: "Supervisor", roleTh: "หัวหน้างาน", color: "bg-amber-500/10 text-amber-700 border-amber-500/20", perms: [true, true, false, true, true, false, false] },
                    { role: "Staff", roleTh: "พนักงาน", color: "bg-blue-500/10 text-blue-700 border-blue-500/20", perms: [false, "own", false, false, "self", false, false] },
                    { role: "Guest", roleTh: "ผู้เยี่ยมชม", color: "bg-gray-500/10 text-gray-700 border-gray-500/20", perms: ["view", false, false, false, false, false, false] },
                  ].map((r, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2 px-3">
                        <Badge variant="outline" className={`text-xs ${r.color}`}>
                          {th ? r.roleTh : r.role}
                        </Badge>
                      </td>
                      {r.perms.map((p, j) => (
                        <td key={j} className="text-center py-2 px-3">
                          {p === true ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                          ) : p === false ? (
                            <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                          ) : p === "own" ? (
                            <span className="text-xs text-amber-600 font-medium">{th ? "ของตัวเอง" : "Own"}</span>
                          ) : p === "self" ? (
                            <span className="text-xs text-amber-600 font-medium">{th ? "ตัวเอง" : "Self"}</span>
                          ) : (
                            <span className="text-xs text-blue-600 font-medium">{th ? "ดูอย่างเดียว" : "View"}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
              <p>• {th ? "Supervisor ไม่สามารถกำหนดบทบาท Executive ได้ (เฉพาะ Admin เท่านั้น)" : "Supervisors cannot assign the Executive role (Admin only)"}</p>
              <p>• {th ? "Staff สามารถบันทึกและแก้ไขข้อมูลของตัวเองเท่านั้น (สถานะ draft/submitted)" : "Staff can only manage their own data entries (draft/submitted status)"}</p>
              <p>• {th ? "ระบบป้องกันการลบ Admin หรือ Supervisor คนสุดท้าย" : "The system prevents deleting the last Admin or Supervisor"}</p>
              <p>• {th ? "ผู้ใช้ที่ถูกปิดใช้งาน (is_active = false) จะไม่สามารถเข้าสู่ระบบได้" : "Deactivated users (is_active = false) cannot log in"}</p>
            </div>
          </CardContent>
        </Card>

        {/* ─── Section 3: Formulas & Calculations ─── */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl rounded-2xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <Calculator className="h-5 w-5 text-amber-600" />
            </div>
            <CardTitle className="text-lg">
              {th ? "สูตรการคำนวณ" : "Formulas & Calculations"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {/* Environmental Formulas */}
              <AccordionItem value="env">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-emerald-600" />
                    {th ? "สิ่งแวดล้อม (Environmental)" : "Environmental"}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <FormulaCard
                      title={th ? "GHG รวม (Total GHG Emissions)" : "Total GHG Emissions"}
                      formula="GHG Total = Scope 1 (MET003) + Scope 2 (MET004)"
                      unit="tCO2e"
                      description={th
                        ? "ผลรวมการปล่อยก๊าซเรือนกระจกทั้งทางตรง (Scope 1) และทางอ้อม (Scope 2)"
                        : "Sum of direct (Scope 1) and indirect (Scope 2) greenhouse gas emissions"}
                      context="negative"
                    />
                    <ExampleCard
                      th={th}
                      inputs={[
                        { label: "GHG Scope 1 (MET003)", value: "120", unit: "tCO2e" },
                        { label: "GHG Scope 2 (MET004)", value: "80", unit: "tCO2e" },
                      ]}
                      steps={["GHG Total = 120 + 80"]}
                      result="200"
                      resultUnit="tCO2e"
                      interpretation={th
                        ? "โรงงานปล่อยก๊าซเรือนกระจกรวม 200 ตันคาร์บอนไดออกไซด์เทียบเท่า"
                        : "The factory emitted a total of 200 tonnes of CO2 equivalent"}
                    />

                    <FormulaCard
                      title={th ? "สัดส่วนพลังงานสะอาด" : "Renewable Energy Ratio"}
                      formula="Renewable % = (Renewable Energy (MET002) / (Grid Electricity (MET001) + Renewable Energy (MET002))) × 100"
                      unit="%"
                      description={th
                        ? "สัดส่วนพลังงานหมุนเวียนต่อพลังงานทั้งหมด ยิ่งสูงยิ่งดี"
                        : "Proportion of renewable energy in total energy consumption. Higher is better."}
                      context="positive"
                    />
                    <ExampleCard
                      th={th}
                      inputs={[
                        { label: th ? "ไฟฟ้าจากกริด (MET001)" : "Grid Electricity (MET001)", value: "70,000", unit: "kWh" },
                        { label: th ? "พลังงานหมุนเวียน (MET002)" : "Renewable Energy (MET002)", value: "30,000", unit: "kWh" },
                      ]}
                      steps={[
                        th ? "พลังงานรวม = 70,000 + 30,000 = 100,000 kWh" : "Total Energy = 70,000 + 30,000 = 100,000 kWh",
                        "Renewable % = (30,000 / 100,000) × 100",
                      ]}
                      result="30.0"
                      resultUnit="%"
                      interpretation={th
                        ? "พลังงานหมุนเวียนคิดเป็น 30% ของพลังงานทั้งหมด"
                        : "Renewable energy accounts for 30% of total energy consumption"}
                    />

                    <FormulaCard
                      title={th ? "อัตราการรีไซเคิลขยะ (Waste Diversion Rate)" : "Waste Diversion Rate"}
                      formula="Diversion Rate = (Waste Recycled (MET021) / Total Waste (MET018)) × 100"
                      unit="%"
                      description={th
                        ? "สัดส่วนขยะที่นำกลับมาใช้ประโยชน์ต่อขยะทั้งหมด ยิ่งสูงยิ่งดี"
                        : "Proportion of waste recycled vs total waste. Higher is better."}
                      context="positive"
                    />
                    <ExampleCard
                      th={th}
                      inputs={[
                        { label: th ? "ขยะทั้งหมด (MET018)" : "Total Waste (MET018)", value: "10,000", unit: "kg" },
                        { label: th ? "ขยะรีไซเคิล (MET021)" : "Waste Recycled (MET021)", value: "4,500", unit: "kg" },
                      ]}
                      steps={["Diversion Rate = (4,500 / 10,000) × 100"]}
                      result="45.0"
                      resultUnit="%"
                      interpretation={th
                        ? "ขยะ 45% ถูกนำกลับมารีไซเคิล ซึ่งช่วยลดปริมาณขยะฝังกลบ"
                        : "45% of waste was recycled, reducing landfill volume"}
                    />

                    <FormulaCard
                      title={th ? "อัตราการรีไซเคิลน้ำ (Water Recycling Rate)" : "Water Recycling Rate"}
                      formula="Water Recycling Rate = (Water Recycled (MET006) / Water Withdrawal (MET005)) × 100"
                      unit="%"
                      description={th
                        ? "สัดส่วนน้ำรีไซเคิลต่อน้ำที่ใช้ทั้งหมด ยิ่งสูงยิ่งดี"
                        : "Proportion of water recycled vs total water withdrawal. Higher is better."}
                      context="positive"
                    />
                    <ExampleCard
                      th={th}
                      inputs={[
                        { label: th ? "น้ำที่ใช้ (MET005)" : "Water Withdrawal (MET005)", value: "8,000", unit: "m³" },
                        { label: th ? "น้ำรีไซเคิล (MET006)" : "Water Recycled (MET006)", value: "2,400", unit: "m³" },
                      ]}
                      steps={["Water Recycling Rate = (2,400 / 8,000) × 100"]}
                      result="30.0"
                      resultUnit="%"
                      interpretation={th
                        ? "น้ำ 30% ถูกนำกลับมาใช้ซ้ำ ช่วยลดการใช้น้ำจากแหล่งธรรมชาติ"
                        : "30% of water was recycled, reducing reliance on natural water sources"}
                    />

                    <FormulaCard
                      title={th ? "สัดส่วนพลังงาน (Energy Mix)" : "Energy Mix"}
                      formula={`Grid % = (Grid Electricity (MET001) / Total Energy) × 100\nRenewable % = (Renewable Energy (MET002) / Total Energy) × 100`}
                      unit="%"
                      description={th
                        ? "สัดส่วนการใช้พลังงานแยกตามแหล่ง"
                        : "Energy consumption breakdown by source"}
                      context="positive"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Social Formulas */}
              <AccordionItem value="soc">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-blue-600" />
                    {th ? "สังคม (Social)" : "Social"}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <FormulaCard
                      title="LTIFR (Lost Time Injury Frequency Rate)"
                      formula="LTIFR = (LTI (MET009) × 1,000,000) / Working Hours (MET035)"
                      unit={th ? "ต่อล้านชั่วโมงทำงาน" : "per million working hours"}
                      description={th
                        ? "อัตราการบาดเจ็บที่ทำให้สูญเสียเวลาทำงาน ต่อ 1 ล้านชั่วโมงทำงาน ยิ่งต่ำยิ่งดี หาก Working Hours = 0 จะแสดงเป็น 0.00"
                        : "Rate of lost-time injuries per 1 million working hours. Lower is better. If Working Hours = 0, displays as 0.00."}
                      context="negative"
                    />
                    {/* LTIFR Detailed Explanation & Example */}
                    <div className="bg-muted/30 rounded-xl p-4 space-y-3 border border-border/30">
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-amber-600" />
                        {th ? "อธิบายสูตร LTIFR อย่างละเอียด" : "LTIFR Formula Explained"}
                      </h4>
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p>
                          {th
                            ? "LTIFR (Lost Time Injury Frequency Rate) เป็นดัชนีมาตรฐานสากลที่ใช้วัดอัตราการเกิดอุบัติเหตุที่ทำให้พนักงานต้องหยุดงาน โดยเทียบกับจำนวนชั่วโมงทำงานทั้งหมด 1 ล้านชั่วโมง"
                            : "LTIFR (Lost Time Injury Frequency Rate) is an internationally recognized safety metric that measures the rate of workplace injuries causing lost work time, normalized per 1 million working hours."}
                        </p>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{th ? "ตัวแปรที่ใช้:" : "Variables:"}</p>
                          <ul className="list-disc pl-5 space-y-1">
                            <li><strong>LTI (MET009)</strong> — {th ? "จำนวนครั้งที่เกิดอุบัติเหตุจนทำให้พนักงานต้องหยุดงาน (Lost Time Injury)" : "Number of injuries resulting in lost work time"}</li>
                            <li><strong>Working Hours (MET035)</strong> — {th ? "จำนวนชั่วโมงทำงานรวมทั้งหมดของพนักงาน" : "Total working hours of all employees"}</li>
                            <li><strong>1,000,000</strong> — {th ? "ตัวคูณมาตรฐาน เพื่อให้ค่าอ่านง่าย (ต่อ 1 ล้านชั่วโมง)" : "Standard multiplier to normalize the rate per 1 million hours"}</li>
                          </ul>
                        </div>
                      </div>

                      {/* Example */}
                      <div className="bg-background/60 rounded-lg p-4 border border-border/30 space-y-3">
                        <p className="font-semibold text-sm text-foreground">
                          {th ? "📌 ตัวอย่างการคำนวณ" : "📌 Calculation Example"}
                        </p>
                        <div className="text-sm space-y-2 text-muted-foreground">
                          <p>{th ? "สมมติโรงงาน A ในปี 2025 มีข้อมูลดังนี้:" : "Suppose Factory A in 2025 has the following data:"}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="bg-muted/30 rounded-lg px-3 py-2">
                              <span className="text-xs text-muted-foreground">{th ? "จำนวน LTI (MET009)" : "LTI Count (MET009)"}</span>
                              <p className="font-bold text-foreground text-lg">3 <span className="text-xs font-normal text-muted-foreground">{th ? "ครั้ง" : "cases"}</span></p>
                            </div>
                            <div className="bg-muted/30 rounded-lg px-3 py-2">
                              <span className="text-xs text-muted-foreground">{th ? "ชั่วโมงทำงานรวม (MET035)" : "Working Hours (MET035)"}</span>
                              <p className="font-bold text-foreground text-lg">500,000 <span className="text-xs font-normal text-muted-foreground">{th ? "ชม." : "hrs"}</span></p>
                            </div>
                          </div>
                          <div className="bg-primary/5 rounded-lg px-3 py-2 border border-primary/20">
                            <p className="text-xs text-muted-foreground mb-1">{th ? "แทนค่าในสูตร:" : "Substituting into the formula:"}</p>
                            <p className="font-mono text-sm text-foreground">
                              LTIFR = (3 × 1,000,000) / 500,000
                            </p>
                            <p className="font-mono text-sm text-foreground">
                              LTIFR = 3,000,000 / 500,000
                            </p>
                            <p className="font-mono text-sm font-bold text-primary">
                              LTIFR = <span className="text-lg">6.00</span>
                            </p>
                          </div>
                          <p>
                            {th
                              ? "หมายความว่า ทุกๆ 1 ล้านชั่วโมงทำงาน จะมีอุบัติเหตุที่ทำให้สูญเสียเวลาทำงาน 6 ครั้ง"
                              : "This means for every 1 million working hours, there are 6 lost-time injuries."}
                          </p>
                        </div>
                      </div>

                      {/* Interpretation Guide */}
                      <div className="text-sm space-y-2">
                        <p className="font-medium text-foreground">{th ? "การตีความค่า LTIFR:" : "Interpreting LTIFR Values:"}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="bg-emerald-500/10 rounded-lg px-3 py-2 border border-emerald-500/20">
                            <p className="font-bold text-emerald-700 text-sm">0.00 - 1.00</p>
                            <p className="text-xs text-emerald-600">{th ? "ดีเยี่ยม — ความปลอดภัยสูง" : "Excellent — High safety"}</p>
                          </div>
                          <div className="bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                            <p className="font-bold text-amber-700 text-sm">1.01 - 5.00</p>
                            <p className="text-xs text-amber-600">{th ? "ปานกลาง — ควรปรับปรุง" : "Moderate — Needs improvement"}</p>
                          </div>
                          <div className="bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                            <p className="font-bold text-red-700 text-sm">&gt; 5.00</p>
                            <p className="text-xs text-red-600">{th ? "สูง — ต้องดำเนินการแก้ไขเร่งด่วน" : "High — Urgent action required"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Edge cases */}
                      <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
                        <p className="font-medium text-foreground mb-1">{th ? "กรณีพิเศษ:" : "Edge Cases:"}</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          <li>{th ? "หาก Working Hours = 0 → LTIFR จะแสดงเป็น 0.00 (ป้องกันหารด้วยศูนย์)" : "If Working Hours = 0 → LTIFR displays as 0.00 (prevents division by zero)"}</li>
                          <li>{th ? "หาก LTI = 0 → LTIFR = 0.00 (ไม่มีอุบัติเหตุ = ดีเยี่ยม)" : "If LTI = 0 → LTIFR = 0.00 (no injuries = excellent)"}</li>
                        </ul>
                      </div>
                    </div>
                    <FormulaCard
                      title={th ? "ชั่วโมงอบรมรวม" : "Total Training Hours"}
                      formula="Total Training = Σ Training Hours (MET008)"
                      unit={th ? "ชั่วโมง" : "hours"}
                      description={th
                        ? "ผลรวมชั่วโมงการฝึกอบรมพนักงานทั้งหมด ยิ่งสูงยิ่งดี"
                        : "Total employee training hours. Higher is better."}
                      context="positive"
                    />
                    <FormulaCard
                      title={th ? "การเข้าถึงสุขภาวะ (Well-being Access)" : "Well-being Access"}
                      formula="Well-being = Σ Well-being Access (MET010)"
                      unit={th ? "คน" : "people"}
                      description={th
                        ? "จำนวนพนักงานที่เข้าถึงโปรแกรมสุขภาวะ ยิ่งสูงยิ่งดี"
                        : "Number of employees with access to well-being programs. Higher is better."}
                      context="positive"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Governance Formulas */}
              <AccordionItem value="gov">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-purple-600" />
                    {th ? "ธรรมาภิบาล (Governance)" : "Governance"}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <FormulaCard
                      title={th ? "เหตุการณ์ธรรมาภิบาล" : "Governance Incidents"}
                      formula="Total = Σ Governance Incidents (MET012)"
                      unit={th ? "เรื่อง" : "cases"}
                      description={th
                        ? "จำนวนเหตุการณ์ด้านธรรมาภิบาลทั้งหมด ยิ่งน้อยยิ่งดี"
                        : "Total governance incidents. Lower is better."}
                      context="negative"
                    />
                    <FormulaCard
                      title={th ? "เหตุการณ์ทุจริต" : "Corruption Incidents"}
                      formula="Total = Σ Corruption Incidents (MET014)"
                      unit={th ? "ข้อ" : "cases"}
                      description={th
                        ? "จำนวนเหตุการณ์ทุจริตที่ตรวจพบ ยิ่งน้อยยิ่งดี"
                        : "Detected corruption incidents. Lower is better."}
                      context="negative"
                    />
                    <FormulaCard
                      title={th ? "ความเสี่ยงใหม่ (Emerging Risk)" : "Emerging Risk"}
                      formula="Total = Σ Emerging Risk (MET013)"
                      unit={th ? "ข้อ" : "items"}
                      description={th
                        ? "จำนวนความเสี่ยงใหม่ที่ระบุได้"
                        : "Number of identified emerging risks"}
                      context="negative"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* YoY Comparison */}
              <AccordionItem value="yoy">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    {th ? "การเปรียบเทียบ Year-over-Year (YoY)" : "Year-over-Year (YoY) Comparison"}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <FormulaCard
                      title={th ? "การเปลี่ยนแปลง YoY" : "YoY Change"}
                      formula="YoY Change (%) = ((Current Year Value - Previous Year Value) / Previous Year Value) × 100"
                      unit="%"
                      description={th
                        ? "ใช้เปรียบเทียบค่าตัวชี้วัดระหว่างปีปัจจุบันกับปีก่อนหน้า"
                        : "Compares metric values between the current and previous year"}
                      context="positive"
                    />
                    <div className="bg-muted/30 rounded-xl p-4 text-sm">
                      <p className="font-medium mb-2">{th ? "สีแนวโน้มตามบริบท:" : "Trend Color by Context:"}</p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-xs">
                            {th ? "บริบทเชิงบวก" : "Positive Context"}
                          </Badge>
                          <span className="text-muted-foreground">
                            {th ? "(เช่น อบรม, สุขภาวะ) — ขึ้น = เขียว, ลง = แดง" : "(e.g., Training, Well-being) — Up = Green, Down = Red"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/20 text-xs">
                            {th ? "บริบทเชิงลบ" : "Negative Context"}
                          </Badge>
                          <span className="text-muted-foreground">
                            {th ? "(เช่น GHG, เหตุการณ์) — ลง = เขียว, ขึ้น = แดง" : "(e.g., GHG, Incidents) — Down = Green, Up = Red"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* ─── Section 4: Module Guide ─── */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl rounded-2xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <HelpCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <CardTitle className="text-lg">
              {th ? "คู่มือการใช้งานแต่ละโมดูล" : "Module Guide"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="dashboard">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    {th ? "แดชบอร์ด (Dashboard)" : "Dashboard"}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                    <li>{th ? "แสดงภาพรวม KPI ที่สำคัญ: จำนวนบริษัท, สถานที่, ตัวชี้วัด" : "Shows key KPIs: Companies, Sites, Metrics"}</li>
                    <li>{th ? "แสดงจำนวนข้อมูลที่ส่งแล้ว (Submitted) และร่าง (Draft)" : "Displays Submitted and Draft data counts"}</li>
                    <li>{th ? "Admin จะเห็น Admin Analytics Dashboard เพิ่มเติม สำหรับวิเคราะห์รูปแบบการใช้งาน" : "Admin sees additional Admin Analytics Dashboard for usage analysis"}</li>
                    <li>{th ? "รองรับ Pull-to-Refresh บนมือถือ" : "Supports Pull-to-Refresh on mobile"}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="dataentry">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <FileInput className="h-4 w-4 text-primary" />
                    {th ? "บันทึกข้อมูล (Data Entry)" : "Data Entry"}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                    <li>{th ? "เลือก บริษัท → สถานที่ → รอบระยะเวลา → ตัวชี้วัด" : "Select Company → Site → Period → Metric"}</li>
                    <li>{th ? "กรอกค่า, แหล่งข้อมูล, หมายเหตุ" : "Enter value, data source, and remarks"}</li>
                    <li>{th ? "สถานะ Draft = บันทึกร่าง, Submitted = ส่งข้อมูลแล้ว" : "Draft = saved as draft, Submitted = data submitted"}</li>
                    <li>{th ? "Staff สามารถแก้ไข/ลบเฉพาะข้อมูลที่ตัวเองบันทึก" : "Staff can only edit/delete their own entries"}</li>
                    <li>{th ? "Admin/Supervisor สามารถจัดการข้อมูลทั้งหมดได้" : "Admin/Supervisor can manage all entries"}</li>
                    <li>{th ? "รองรับการนำเข้าข้อมูลจาก Excel (Import)" : "Supports Excel data import"}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="reports">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    {th ? "รายงาน (Reports)" : "Reports"}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                    <li>{th ? "Executive Dashboard: ภาพรวม KPI ทั้งหมด พร้อมกราฟแนวโน้ม" : "Executive Dashboard: Overall KPI summary with trend charts"}</li>
                    <li>{th ? "Environmental: วิเคราะห์ GHG, พลังงาน, น้ำ, ขยะ" : "Environmental: Analyzes GHG, Energy, Water, Waste"}</li>
                    <li>{th ? "Social: วิเคราะห์อบรม, ความปลอดภัย (LTIFR), สุขภาวะ" : "Social: Analyzes Training, Safety (LTIFR), Well-being"}</li>
                    <li>{th ? "Governance: วิเคราะห์เหตุการณ์ธรรมาภิบาล, ทุจริต" : "Governance: Analyzes governance and corruption incidents"}</li>
                    <li>{th ? "ESG Overview: ภาพรวมรวมทุกมิติ พร้อม Radar Chart" : "ESG Overview: Consolidated view with Radar Chart"}</li>
                    <li>{th ? "รองรับ Filter ตาม บริษัท, สถานที่, ปี และแสดง All Time ได้" : "Supports filtering by Company, Site, Year, and All Time view"}</li>
                    <li>{th ? "Export Excel พร้อม header ตามภาษาที่เลือก ชื่อไฟล์เป็นภาษาอังกฤษ" : "Export Excel with localized headers, English filenames"}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="masterdata">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    {th ? "ข้อมูลหลัก (Master Data)" : "Master Data"}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                    <li>{th ? "จัดการ: บริษัท, สถานที่, รอบระยะเวลา, มิติ ESG, หัวข้อ ESG, ตัวชี้วัด ESG" : "Manage: Companies, Sites, Periods, Dimensions, Themes, Metrics"}</li>
                    <li>{th ? "รหัส (ID) ถูกสร้างอัตโนมัติ เช่น COMP001, SITE001, MET001" : "IDs are auto-generated (e.g., COMP001, SITE001, MET001)"}</li>
                    <li>{th ? "ก่อนลบจะมีการตรวจสอบ dependency (ข้อมูลที่เกี่ยวข้อง)" : "Dependency checks before deletion"}</li>
                    <li>{th ? "สิทธิ์เฉพาะ Admin และ Supervisor เท่านั้น" : "Access restricted to Admin and Supervisor only"}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="usermgmt">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {th ? "จัดการผู้ใช้ (User Management)" : "User Management"}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                    <li>{th ? "Admin เห็นผู้ใช้ทั้งหมด, Supervisor เห็นทุกคนยกเว้น Admin" : "Admin sees all users, Supervisor sees everyone except Admins"}</li>
                    <li>{th ? "สร้างบัญชีผู้ใช้ใหม่ กำหนดบทบาท บริษัท สถานที่" : "Create users with role, company, site assignments"}</li>
                    <li>{th ? "เปิด/ปิดสถานะ Active ได้ (ยกเว้น Admin/Supervisor คนสุดท้าย)" : "Toggle Active status (except last Admin/Supervisor)"}</li>
                    <li>{th ? "Staff/Executive ต้องกำหนด บริษัท และ สถานที่ เสมอ" : "Staff/Executive require Company and Site assignment"}</li>
                    <li>{th ? "Executive/Staff สามารถเข้าหน้านี้เพื่อเปลี่ยนรหัสผ่านของตัวเองเท่านั้น" : "Executive/Staff can only change their own password"}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="auditlog">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    {th ? "บันทึกการใช้งาน (Audit Log)" : "Audit Log"}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                    <li>{th ? "บันทึกทุกการเปลี่ยนแปลงในระบบอัตโนมัติ" : "Automatically logs all system changes"}</li>
                    <li>{th ? "แสดง: ผู้กระทำ, การกระทำ, ข้อมูลก่อน/หลัง, เวลา" : "Shows: Actor, Action, Before/After data, Timestamp"}</li>
                    <li>{th ? "เฉพาะ Admin เท่านั้นที่เข้าถึงได้" : "Admin access only"}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="backup">
                <AccordionTrigger className="text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-primary" />
                    {th ? "สำรองข้อมูล (Backup Data)" : "Backup Data"}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                    <li>{th ? "ส่งออกข้อมูลทั้งหมดเป็น Excel สำหรับสำรองข้อมูล" : "Export all data as Excel for backup purposes"}</li>
                    <li>{th ? "เฉพาะ Admin เท่านั้นที่เข้าถึงได้" : "Admin access only"}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* ─── Section 5: Metric ID Reference ─── */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl rounded-2xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-xl bg-purple-500/10">
              <Database className="h-5 w-5 text-purple-600" />
            </div>
            <CardTitle className="text-lg">
              {th ? "รหัสตัวชี้วัดอ้างอิง" : "Metric ID Reference"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-semibold">{th ? "รหัส" : "ID"}</th>
                    <th className="text-left py-2 px-3 font-semibold">{th ? "ตัวชี้วัด" : "Metric"}</th>
                    <th className="text-left py-2 px-3 font-semibold">{th ? "มิติ" : "Dimension"}</th>
                    <th className="text-left py-2 px-3 font-semibold">{th ? "หน่วย" : "Unit"}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "MET001", name: th ? "ไฟฟ้าจากกริด" : "Grid Electricity", dim: "E", unit: "kWh" },
                    { id: "MET002", name: th ? "พลังงานหมุนเวียน" : "Renewable Energy", dim: "E", unit: "kWh" },
                    { id: "MET003", name: "GHG Scope 1", dim: "E", unit: "tCO2e" },
                    { id: "MET004", name: "GHG Scope 2", dim: "E", unit: "tCO2e" },
                    { id: "MET005", name: th ? "น้ำที่ใช้" : "Water Withdrawal", dim: "E", unit: "m³" },
                    { id: "MET006", name: th ? "น้ำรีไซเคิล" : "Water Recycled", dim: "E", unit: "m³" },
                    { id: "MET007", name: th ? "น้ำทิ้ง" : "Wastewater", dim: "E", unit: "m³" },
                    { id: "MET018", name: th ? "ขยะทั้งหมด" : "Total Waste", dim: "E", unit: "kg" },
                    { id: "MET021", name: th ? "ขยะรีไซเคิล" : "Waste Recycled", dim: "E", unit: "kg" },
                    { id: "MET008", name: th ? "ชั่วโมงอบรม" : "Training Hours", dim: "S", unit: th ? "ชม." : "hrs" },
                    { id: "MET009", name: "LTI", dim: "S", unit: th ? "ครั้ง" : "cases" },
                    { id: "MET010", name: th ? "Well-being Access" : "Well-being Access", dim: "S", unit: th ? "คน" : "people" },
                    { id: "MET017", name: th ? "การละเมิดสิทธิมนุษยชน" : "Human Rights Violations", dim: "S", unit: th ? "ข้อ" : "cases" },
                    { id: "MET020", name: th ? "บริจาคอาหาร" : "Food Donation", dim: "S", unit: "kg" },
                    { id: "MET035", name: th ? "ชั่วโมงทำงาน" : "Working Hours", dim: "S", unit: th ? "ชม." : "hrs" },
                    { id: "MET012", name: th ? "เหตุการณ์ธรรมาภิบาล" : "Governance Incidents", dim: "G", unit: th ? "เรื่อง" : "cases" },
                    { id: "MET013", name: th ? "ความเสี่ยงใหม่" : "Emerging Risk", dim: "G", unit: th ? "ข้อ" : "items" },
                    { id: "MET014", name: th ? "เหตุการณ์ทุจริต" : "Corruption Incidents", dim: "G", unit: th ? "ข้อ" : "cases" },
                    { id: "MET015", name: th ? "อบรมภาษี" : "Tax Training", dim: "G", unit: th ? "ชม." : "hrs" },
                  ].map((m, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2 px-3 font-mono text-xs">{m.id}</td>
                      <td className="py-2 px-3">{m.name}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className={`text-xs ${
                          m.dim === "E" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" :
                          m.dim === "S" ? "bg-blue-500/10 text-blue-700 border-blue-500/20" :
                          "bg-purple-500/10 text-purple-700 border-purple-500/20"
                        }`}>
                          {m.dim}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{m.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ─── Section 6: Data Status Flow ─── */}
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl rounded-2xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-xl bg-cyan-500/10">
              <AlertTriangle className="h-5 w-5 text-cyan-600" />
            </div>
            <CardTitle className="text-lg">
              {th ? "สถานะข้อมูลและการไหลของข้อมูล" : "Data Status & Workflow"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2 bg-muted/30 rounded-xl px-4 py-3">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="font-medium">Draft</span>
                <span className="text-muted-foreground text-xs">({th ? "ร่าง - แก้ไขได้" : "Editable"})</span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex items-center gap-2 bg-muted/30 rounded-xl px-4 py-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="font-medium">Submitted</span>
                <span className="text-muted-foreground text-xs">({th ? "ส่งแล้ว" : "Sent"})</span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex items-center gap-2 bg-muted/30 rounded-xl px-4 py-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="font-medium">Approved</span>
                <span className="text-muted-foreground text-xs">({th ? "อนุมัติแล้ว" : "Verified"})</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {th
                ? "ข้อมูลสถานะ Draft และ Submitted จะถูกนำเข้ารายงาน ข้อมูลที่ Approved จะเป็นข้อมูลที่ได้รับการยืนยันแล้ว"
                : "Draft and Submitted data are included in reports. Approved data has been verified."}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── Reusable Formula Card ───
function FormulaCard({
  title,
  formula,
  unit,
  description,
  context,
}: {
  title: string;
  formula: string;
  unit: string;
  description: string;
  context: "positive" | "negative";
}) {
  return (
    <div className="bg-muted/30 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-sm text-foreground">{title}</h4>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${
          context === "positive"
            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
            : "bg-red-500/10 text-red-700 border-red-500/20"
        }`}>
          {context === "positive" ? "↑ ยิ่งสูงยิ่งดี" : "↓ ยิ่งต่ำยิ่งดี"}
        </Badge>
      </div>
      <div className="bg-background/60 rounded-lg px-3 py-2 font-mono text-xs text-foreground whitespace-pre-wrap border border-border/30">
        {formula}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">{unit}</span>
        <span>—</span>
        <span>{description}</span>
      </div>
    </div>
  );
}

// ─── Reusable Example Card ───
function ExampleCard({
  th,
  inputs,
  steps,
  result,
  resultUnit,
  interpretation,
}: {
  th: boolean;
  inputs: { label: string; value: string; unit: string }[];
  steps: string[];
  result: string;
  resultUnit: string;
  interpretation: string;
}) {
  return (
    <div className="bg-background/60 rounded-lg p-4 border border-border/30 space-y-3 ml-2">
      <p className="font-semibold text-sm text-foreground">
        {th ? "📌 ตัวอย่างการคำนวณ" : "📌 Calculation Example"}
      </p>
      <div className="text-sm space-y-2 text-muted-foreground">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {inputs.map((inp, i) => (
            <div key={i} className="bg-muted/30 rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground">{inp.label}</span>
              <p className="font-bold text-foreground text-lg">
                {inp.value} <span className="text-xs font-normal text-muted-foreground">{inp.unit}</span>
              </p>
            </div>
          ))}
        </div>
        <div className="bg-primary/5 rounded-lg px-3 py-2 border border-primary/20 space-y-0.5">
          <p className="text-xs text-muted-foreground mb-1">{th ? "แทนค่าในสูตร:" : "Substituting:"}</p>
          {steps.map((step, i) => (
            <p key={i} className="font-mono text-sm text-foreground">{step}</p>
          ))}
          <p className="font-mono text-sm font-bold text-primary">
            = <span className="text-lg">{result}</span> {resultUnit}
          </p>
        </div>
        <p>{interpretation}</p>
      </div>
    </div>
  );
}
