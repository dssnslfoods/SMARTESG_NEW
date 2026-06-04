import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMenuPermissions } from '@/contexts/MenuPermissionsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  BookOpen, LayoutDashboard, Network, FileInput, BarChart3, Leaf, Heart, Scale,
  Cloud, Globe, Building2, MapPin, Calendar, Layers, Tag, Activity, Target,
  LayoutGrid, Settings, Users, History, HardDrive, Lightbulb, Rocket, ShieldCheck,
} from 'lucide-react';

// ─── Guide content, keyed by sidebar menu key ────────────────────────────────
interface Guide {
  key: string;            // matches menu_key used by canSeeMenu()
  feature?: string;       // optional super-admin feature flag gate
  section: 'main' | 'master' | 'admin';
  icon: typeof BookOpen;
  titleEn: string; titleTh: string;
  introEn: string; introTh: string;
  stepsEn: string[]; stepsTh: string[];
  tipEn?: string; tipTh?: string;
}

const GUIDES: Guide[] = [
  // ── MAIN MENU ──────────────────────────────────────────────────────────────
  {
    key: 'dashboard', section: 'main', icon: LayoutDashboard,
    titleEn: 'Dashboard', titleTh: 'แดชบอร์ด',
    introEn: 'Your landing page — a quick overview of the ESG data in your tenant.',
    introTh: 'หน้าแรกหลังเข้าสู่ระบบ — แสดงภาพรวมข้อมูล ESG ขององค์กรอย่างรวดเร็ว',
    stepsEn: [
      'Open the app and sign in — you land on the Dashboard automatically.',
      'Read the summary cards (companies, sites, metrics, recent activity).',
      'Executives see a one-page Executive Summary with target achievement, dimension performance and headline metrics.',
      'Use the Company / Site / Year filters at the top of the Executive Summary to narrow the whole dashboard to a scope.',
      'Click any headline metric card to jump to its detail view.',
    ],
    stepsTh: [
      'เข้าสู่ระบบ — ระบบจะพามาที่หน้า Dashboard อัตโนมัติ',
      'ดูการ์ดสรุป (จำนวนบริษัท สถานที่ ตัวชี้วัด และกิจกรรมล่าสุด)',
      'ผู้บริหาร (Executive) จะเห็น Executive Summary แบบหน้าเดียว — ผลการบรรลุเป้า ผลรายมิติ และตัวชี้วัดหลัก',
      'ใช้ตัวกรอง บริษัท / สถานที่ / ปี ด้านบน Executive Summary เพื่อจำกัดข้อมูลทั้งแดชบอร์ดตามขอบเขตที่เลือก',
      'คลิกการ์ดตัวชี้วัดเพื่อดูรายละเอียดเชิงลึก',
    ],
    tipTh: 'ผู้ใช้แต่ละบทบาทจะเห็นการ์ดต่างกันตามสิทธิ์',
    tipEn: 'Each role sees different cards based on permissions.',
  },
  {
    key: 'esg-key-issues', section: 'main', icon: Network,
    titleEn: 'ESG Key Issues', titleTh: 'ESG Key Issues',
    introEn: 'The materiality framework: Dimension → Theme → Metric, with target progress bars on each metric.',
    introTh: 'โครงสร้างประเด็นสำคัญ: มิติ (Dimension) → หัวข้อ (Theme) → ตัวชี้วัด (Metric) พร้อมแถบความคืบหน้าตามเป้าหมาย',
    stepsEn: [
      'Use the Scope filters (Company / Site / Year) to set which data the progress bars are calculated from.',
      'Use the hierarchy filter chips to drill down by Dimension → Theme → Metric.',
      'Each metric card shows a coloured progress bar: green = on target, amber = approaching, red = off target.',
      'Click a metric to open its infographic — trend by period, by site, and target achievement (respecting the same scope).',
      'Hover a progress bar to see the exact value vs the current-year and long-term targets.',
      'Use "Big Picture View" to see the whole framework on one page and export it as a PDF.',
    ],
    stepsTh: [
      'ใช้ตัวกรองขอบเขต (บริษัท / สถานที่ / ปี) เพื่อกำหนดว่าจะคำนวณแถบความคืบหน้าจากข้อมูลชุดไหน',
      'ใช้ชิปกรองตามลำดับขั้นเพื่อเจาะลึก มิติ → หัวข้อ → ตัวชี้วัด',
      'แถบสีบนการ์ด: เขียว = บรรลุเป้า, เหลือง = ใกล้เป้า, แดง = ต่ำกว่าเป้า',
      'คลิกตัวชี้วัดเพื่อดู Infographic — แนวโน้มรายเดือน รายสถานที่ และผลการบรรลุเป้า (ใช้ขอบเขตเดียวกัน)',
      'เลื่อนเมาส์ที่แถบความคืบหน้าเพื่อดูค่าจริงเทียบเป้าปีนี้และเป้าระยะยาว',
      'กด "ภาพรวมทั้งหมด (Big Picture View)" เพื่อดูโครงสร้างทั้งหมดในหน้าเดียว และดาวน์โหลดเป็น PDF',
    ],
    tipTh: 'แถบเป้าหมายจะแสดงเฉพาะตัวชี้วัดที่ตั้งเป้า (KPI Target) ไว้แล้วเท่านั้น',
    tipEn: 'The target bar only appears on metrics that already have a KPI Target set.',
  },
  {
    key: 'data-entry', section: 'main', icon: FileInput,
    titleEn: 'Data Entry', titleTh: 'บันทึกข้อมูล',
    introEn: 'Where you record ESG metric values for a company, site and reporting period.',
    introTh: 'หน้าสำหรับบันทึกค่าตัวชี้วัด ESG ตามบริษัท สถานที่ และรอบรายงาน',
    stepsEn: [
      'Click "Add Data" to open the entry form.',
      'Pick Company → Site → Reporting Period (the period list comes from master data).',
      'Choose the Dimension → Theme → Metric you are recording.',
      'Enter the Value, set Status to Draft (work-in-progress) or Submit (final), then Save.',
      'Use the filters and search on the records table to find, edit (✏️) or delete (🗑️) entries.',
    ],
    stepsTh: [
      'กด "Add Data" เพื่อเปิดฟอร์มบันทึก',
      'เลือก บริษัท → สถานที่ → รอบรายงาน (รายการรอบมาจากข้อมูลหลัก)',
      'เลือก มิติ → หัวข้อ → ตัวชี้วัด ที่ต้องการบันทึก',
      'กรอกค่า เลือกสถานะ Draft (ร่าง) หรือ Submit (ส่ง/ขั้นสุดท้าย) แล้วกด Save',
      'ใช้ตัวกรองและช่องค้นหาในตาราง เพื่อค้นหา แก้ไข (✏️) หรือลบ (🗑️) ข้อมูล',
    ],
    tipTh: 'ตัวชี้วัดที่ตั้งเป็นโหมดคำนวณอัตโนมัติจะกรอกค่าเองไม่ได้ — ช่องค่าจะถูกล็อกและระบบคำนวณให้',
    tipEn: 'Metrics set to auto-calculation can’t be typed in — the value field is locked and the system computes it.',
  },
  {
    key: 'reports', section: 'main', icon: BarChart3,
    titleEn: 'Reports', titleTh: 'รายงาน',
    introEn: 'The reporting hub — pick a dimension report to analyse performance with charts.',
    introTh: 'ศูนย์รวมรายงาน — เลือกรายงานแต่ละมิติเพื่อวิเคราะห์ผลด้วยกราฟ',
    stepsEn: [
      'Open Reports to see the available dimension reports.',
      'Filter by Company, Site and Year at the top of each report.',
      'Use "Export Excel" to download the data, or "TV View" for a presentation display.',
    ],
    stepsTh: [
      'เปิดเมนู Reports เพื่อดูรายงานแต่ละมิติที่มี',
      'กรองตาม บริษัท สถานที่ และปี ที่ด้านบนของแต่ละรายงาน',
      'กด "Export Excel" เพื่อดาวน์โหลดข้อมูล หรือ "TV View" สำหรับจอนำเสนอ',
    ],
  },
  {
    key: 'reports/environmental', section: 'main', icon: Leaf,
    titleEn: 'Environmental Report', titleTh: 'รายงานสิ่งแวดล้อม',
    introEn: 'Energy, GHG, water and waste KPIs with monthly trends and per-site comparison.',
    introTh: 'ตัวชี้วัดด้านพลังงาน ก๊าซเรือนกระจก น้ำ และของเสีย พร้อมแนวโน้มรายเดือนและเปรียบเทียบรายสถานที่',
    stepsEn: [
      'Read the KPI cards (GHG, electricity, renewable %, water, waste, diversion rate).',
      'Scroll for monthly trend charts and water-balance / waste breakdowns.',
      'Apply Company / Site / Year filters to focus the analysis.',
    ],
    stepsTh: [
      'ดูการ์ด KPI (GHG, ไฟฟ้า, พลังงานหมุนเวียน %, น้ำ, ของเสีย, อัตราการนำกลับมาใช้)',
      'เลื่อนดูกราฟแนวโน้มรายเดือน และการแยกสมดุลน้ำ / ของเสีย',
      'ใช้ตัวกรอง บริษัท / สถานที่ / ปี เพื่อเจาะวิเคราะห์',
    ],
  },
  {
    key: 'reports/social', section: 'main', icon: Heart,
    titleEn: 'Social Report', titleTh: 'รายงานสังคม',
    introEn: 'People KPIs — training, safety (LTI), well-being, community and human rights.',
    introTh: 'ตัวชี้วัดด้านบุคลากร — การอบรม ความปลอดภัย (LTI) สวัสดิภาพ ชุมชน และสิทธิมนุษยชน',
    stepsEn: [
      'Review the headline social KPIs at the top.',
      'Examine trends by period and comparison by site.',
      'Filter by Company / Site / Year as needed.',
    ],
    stepsTh: [
      'ดูตัวชี้วัดสังคมหลักด้านบน',
      'ดูแนวโน้มรายช่วงเวลาและเปรียบเทียบรายสถานที่',
      'กรองตาม บริษัท / สถานที่ / ปี ตามต้องการ',
    ],
  },
  {
    key: 'reports/governance', section: 'main', icon: Scale,
    titleEn: 'Governance Report', titleTh: 'รายงานธรรมาภิบาล',
    introEn: 'Governance KPIs — board, compliance, anti-corruption, risk and tax.',
    introTh: 'ตัวชี้วัดธรรมาภิบาล — คณะกรรมการ การกำกับ ต่อต้านทุจริต ความเสี่ยง และภาษี',
    stepsEn: [
      'Read governance incident and training KPIs.',
      'Use the theme distribution and cumulative charts to spot issues.',
      'Filter by Company / Site / Year.',
    ],
    stepsTh: [
      'ดูตัวชี้วัดเหตุการณ์ด้านธรรมาภิบาลและการอบรม',
      'ใช้กราฟการกระจายตามหัวข้อ และกราฟสะสม เพื่อจับประเด็น',
      'กรองตาม บริษัท / สถานที่ / ปี',
    ],
  },
  {
    key: 'reports/ghg', feature: 'ghg_auto_calc', section: 'main', icon: Cloud,
    titleEn: 'GHG Emissions', titleTh: 'การปล่อย GHG',
    introEn: 'A dedicated greenhouse-gas dashboard: Scope 1/2 breakdown and a Net-Zero trajectory.',
    introTh: 'แดชบอร์ดก๊าซเรือนกระจกโดยเฉพาะ: แยก Scope 1/2 และเส้นทางสู่ Net Zero',
    stepsEn: [
      'See total Scope 1+2 (YTD), Scope 1, Scope 2 and the Year-over-Year change.',
      'The donut splits emissions by scope; the trajectory chart shows yearly totals vs the target line.',
      'Monthly and by-site stacked charts break the emissions down further.',
    ],
    stepsTh: [
      'ดูรวม Scope 1+2 (YTD), Scope 1, Scope 2 และการเปลี่ยนแปลงเทียบปีก่อน (YoY)',
      'โดนัทแยกการปล่อยตาม Scope · กราฟแนวโน้มแสดงยอดรายปีเทียบเส้นเป้าหมาย',
      'กราฟรายเดือนและรายสถานที่ช่วยแยกการปล่อยให้ละเอียดขึ้น',
    ],
    tipTh: 'ค่า GHG มาจากการคำนวณอัตโนมัติด้วย Emission Factor — ดูวิธีตั้งค่าได้ที่เมนู "ตั้งค่า GHG"',
    tipEn: 'GHG figures are auto-calculated using emission factors — see the "GHG Settings" menu to configure them.',
  },
  {
    key: 'reports/esg-overview', section: 'main', icon: Globe,
    titleEn: 'ESG Overview', titleTh: 'ภาพรวม ESG',
    introEn: 'A consolidated cross-dimension view of Environmental, Social and Governance together.',
    introTh: 'มุมมองรวมข้ามมิติ — สิ่งแวดล้อม สังคม และธรรมาภิบาล ในที่เดียว',
    stepsEn: [
      'Use it for an at-a-glance ESG status across all pillars.',
      'Drill into any pillar from here, or filter by year.',
    ],
    stepsTh: [
      'ใช้ดูสถานะ ESG ครบทุกเสาหลักในมุมมองเดียว',
      'เจาะเข้าแต่ละเสาหลักจากที่นี่ หรือกรองตามปี',
    ],
  },

  // ── MASTER DATA ────────────────────────────────────────────────────────────
  {
    key: 'master/companies', section: 'master', icon: Building2,
    titleEn: 'Companies', titleTh: 'บริษัท',
    introEn: 'Define the companies in your group. Everything else (sites, data) hangs off a company.',
    introTh: 'กำหนดบริษัทในเครือ — ทุกอย่าง (สถานที่ ข้อมูล) ผูกอยู่กับบริษัท',
    stepsEn: [
      'Click Add to create a company; enter its name, industry and country.',
      'Edit or delete existing companies from the list.',
    ],
    stepsTh: [
      'กด Add เพื่อสร้างบริษัท ใส่ชื่อ อุตสาหกรรม และประเทศ',
      'แก้ไขหรือลบบริษัทที่มีอยู่จากรายการ',
    ],
    tipTh: 'ตั้งค่า "บริษัท" ก่อน แล้วจึงค่อยสร้าง "สถานที่"',
    tipEn: 'Set up "Companies" first, then create "Sites".',
  },
  {
    key: 'master/sites', section: 'master', icon: MapPin,
    titleEn: 'Sites', titleTh: 'สถานที่',
    introEn: 'Physical locations (factories, offices, centres) where data is recorded.',
    introTh: 'สถานที่จริง (โรงงาน สำนักงาน ศูนย์) ที่ใช้บันทึกข้อมูล',
    stepsEn: [
      'Add a site and assign it to a company.',
      'Set its location/region; this drives the per-site comparisons in reports.',
    ],
    stepsTh: [
      'เพิ่มสถานที่ และผูกกับบริษัท',
      'ระบุพื้นที่/จังหวัด — ใช้แสดงผลเปรียบเทียบรายสถานที่ในรายงาน',
    ],
  },
  {
    key: 'master/periods', section: 'master', icon: Calendar,
    titleEn: 'Reporting Periods', titleTh: 'รอบรายงาน',
    introEn: 'The months/years available for data entry. Data is recorded against a period.',
    introTh: 'รอบเดือน/ปีที่ใช้กรอกข้อมูล — ทุกค่าบันทึกตามรอบรายงาน',
    stepsEn: [
      'Add the reporting periods you collect data for (e.g. each month).',
      'In Data Entry the period dropdown lists exactly what you define here.',
    ],
    stepsTh: [
      'เพิ่มรอบรายงานที่ต้องเก็บข้อมูล (เช่น รายเดือน)',
      'ในหน้า Data Entry ช่องเลือกรอบจะแสดงตามที่กำหนดที่นี่เป๊ะ',
    ],
  },
  {
    key: 'master/dimensions', section: 'master', icon: Layers,
    titleEn: 'Dimensions', titleTh: 'มิติ ESG',
    introEn: 'The top level of the framework — typically Environment, Social, Governance.',
    introTh: 'ระดับบนสุดของโครงสร้าง — โดยทั่วไปคือ Environment, Social, Governance',
    stepsEn: ['Create or rename dimensions to match your reporting framework.'],
    stepsTh: ['สร้างหรือเปลี่ยนชื่อมิติให้ตรงกับกรอบรายงานของคุณ'],
  },
  {
    key: 'master/themes', section: 'master', icon: Tag,
    titleEn: 'Themes', titleTh: 'หัวข้อหลัก',
    introEn: 'The second level — groups of metrics under a dimension (e.g. Energy, GHG).',
    introTh: 'ระดับที่สอง — กลุ่มตัวชี้วัดภายใต้มิติ (เช่น พลังงาน, GHG)',
    stepsEn: ['Add a theme and link it to its dimension.'],
    stepsTh: ['เพิ่มหัวข้อ และผูกกับมิติของมัน'],
  },
  {
    key: 'master/metrics', section: 'master', icon: Activity,
    titleEn: 'Metrics', titleTh: 'ตัวชี้วัด',
    introEn: 'The actual KPIs you record (e.g. electricity in kWh, GHG in tCO₂e).',
    introTh: 'ตัวชี้วัดที่ใช้บันทึกจริง (เช่น ไฟฟ้า kWh, GHG tCO₂e)',
    stepsEn: [
      'Add a metric, set its unit and link it to a theme.',
      'Choose how it aggregates over time: sum (totals) or average (rates / %).',
      'Metrics defined here appear in the Data Entry form.',
    ],
    stepsTh: [
      'เพิ่มตัวชี้วัด กำหนดหน่วย และผูกกับหัวข้อ',
      'เลือกวิธีรวมค่าตามเวลา: ผลรวม (sum) สำหรับยอดรวม หรือ ค่าเฉลี่ย (avg) สำหรับอัตรา/เปอร์เซ็นต์',
      'ตัวชี้วัดที่กำหนดที่นี่จะปรากฏในฟอร์ม Data Entry',
    ],
  },
  {
    key: 'master/targets', section: 'master', icon: Target,
    titleEn: 'KPI Targets', titleTh: 'เป้าหมาย KPI',
    introEn: 'Set annual and long-term targets per metric to track progress.',
    introTh: 'ตั้งเป้าหมายรายปีและระยะยาวต่อตัวชี้วัด เพื่อติดตามความคืบหน้า',
    stepsEn: [
      'Pick a year and a metric, then enter the target value.',
      'Choose direction: higher-is-better (e.g. renewable) or lower-is-better (e.g. GHG).',
      'Targets drive the progress bars in ESG Key Issues and the Executive dashboard.',
    ],
    stepsTh: [
      'เลือกปีและตัวชี้วัด แล้วใส่ค่าเป้าหมาย',
      'เลือกทิศทาง: ยิ่งสูงยิ่งดี (เช่น พลังงานหมุนเวียน) หรือ ยิ่งต่ำยิ่งดี (เช่น GHG)',
      'เป้าหมายจะแสดงผลเป็นแถบความคืบหน้าในหน้า ESG Key Issues และ Executive dashboard',
    ],
  },
  {
    key: 'master/ghg-settings', feature: 'ghg_auto_calc', section: 'master', icon: Cloud,
    titleEn: 'GHG Settings', titleTh: 'ตั้งค่า GHG',
    introEn: 'Configure automatic GHG calculation: emission factors + which activities feed each GHG metric.',
    introTh: 'ตั้งค่าการคำนวณ GHG อัตโนมัติ: Emission Factor + กิจกรรมที่รวมเข้าแต่ละตัวชี้วัด GHG',
    stepsEn: [
      'Add Emission Factors: pick an activity (e.g. diesel), its scope and the kgCO₂e factor (TGO reference).',
      'In "GHG Auto-Calculation", switch a GHG metric to Auto.',
      'Tick the activities that feed it — the system computes activity × factor ÷ 1000 = tCO₂e automatically.',
      'From then on, users only enter the activity values; GHG is computed for them.',
    ],
    stepsTh: [
      'เพิ่ม Emission Factor: เลือกกิจกรรม (เช่น ดีเซล) ระบุ Scope และค่า kgCO₂e (อ้างอิง TGO)',
      'ในส่วน "การคำนวณ GHG อัตโนมัติ" สลับตัวชี้วัด GHG เป็นโหมด Auto',
      'ติ๊กเลือกกิจกรรมที่จะรวมเข้า — ระบบจะคำนวณ กิจกรรม × factor ÷ 1000 = tCO₂e ให้อัตโนมัติ',
      'จากนั้น user แค่กรอกค่ากิจกรรม ระบบคำนวณ GHG ให้เอง',
    ],
    tipTh: 'ค่า GHG จะเป็นสถานะ Draft จนกว่ากิจกรรมที่เกี่ยวข้องทั้งหมดจะถูก Submit',
    tipEn: 'GHG stays Draft until all of its contributing activities are Submitted.',
  },
  {
    key: 'master/menu-permissions', section: 'master', icon: LayoutGrid,
    titleEn: 'Menu Permissions', titleTh: 'สิทธิ์เมนู',
    introEn: 'Admin controls which roles in your tenant can see which sidebar menus.',
    introTh: 'Admin กำหนดว่า role ใดในองค์กรเห็นเมนูใดใน Sidebar ได้บ้าง',
    stepsEn: [
      'Toggle each menu on/off per role (Supervisor, Executive, Staff, Guest).',
      'Changes apply instantly; users see the new menus after a refresh.',
      'Use "Reset to System Defaults" to restore the recommended setup.',
    ],
    stepsTh: [
      'เปิด/ปิดแต่ละเมนูต่อ role (Supervisor, Executive, Staff, Guest)',
      'มีผลทันที — ผู้ใช้จะเห็นเมนูใหม่หลัง refresh',
      'กด "คืนค่าเริ่มต้นของระบบ" เพื่อกลับไปใช้ค่าที่แนะนำ',
    ],
    tipTh: 'Admin เห็นทุกเมนูเสมอ — หน้านี้ควบคุมเฉพาะ role อื่น',
    tipEn: 'Admin always sees every menu — this page controls the other roles.',
  },
  {
    key: 'master/settings', section: 'master', icon: Settings,
    titleEn: 'System Settings', titleTh: 'ตั้งค่าระบบ',
    introEn: 'Tenant-wide settings such as the long-term target year and data-entry period rules.',
    introTh: 'ตั้งค่าระดับองค์กร เช่น ปีเป้าหมายระยะยาว และกฎการแสดงรอบในหน้ากรอกข้อมูล',
    stepsEn: ['Adjust the available settings and save; they apply across your tenant.'],
    stepsTh: ['ปรับค่าที่มีและบันทึก — มีผลทั้งองค์กร'],
  },

  // ── ADMINISTRATION ─────────────────────────────────────────────────────────
  {
    key: 'users', section: 'admin', icon: Users,
    titleEn: 'User Management', titleTh: 'จัดการผู้ใช้',
    introEn: 'Create users, assign roles and link them to a company/site.',
    introTh: 'สร้างผู้ใช้ กำหนดบทบาท และผูกกับบริษัท/สถานที่',
    stepsEn: [
      'Click Add User; enter email, password, full name and role.',
      'Assign Company and Site (required for Staff so they see their location).',
      'Use the row actions to edit a profile, reset a password (🔑) or deactivate a user.',
    ],
    stepsTh: [
      'กด Add User; ใส่ อีเมล รหัสผ่าน ชื่อ และบทบาท',
      'กำหนดบริษัทและสถานที่ (จำเป็นสำหรับ Staff เพื่อให้เห็นสถานที่ของตน)',
      'ใช้ปุ่มในแถวเพื่อแก้ไขโปรไฟล์ รีเซ็ตรหัสผ่าน (🔑) หรือปิดใช้งานผู้ใช้',
    ],
    tipTh: 'บทบาท: Admin (จัดการทั้งหมด) · Supervisor (อนุมัติ/จัดการข้อมูล) · Staff (กรอกข้อมูล) · Executive (ดูรายงาน) · Guest (ดูอย่างเดียว)',
    tipEn: 'Roles: Admin (manage everything) · Supervisor (approve/manage data) · Staff (enter data) · Executive (view reports) · Guest (read-only).',
  },
  {
    key: 'audit-log', section: 'admin', icon: History,
    titleEn: 'Audit Log', titleTh: 'บันทึกกิจกรรม',
    introEn: 'A human-readable history of every change, with the ability to restore deleted/edited records.',
    introTh: 'ประวัติการเปลี่ยนแปลงทั้งหมดแบบอ่านง่าย พร้อมกู้คืนข้อมูลที่ถูกลบ/แก้ไขได้',
    stepsEn: [
      'Browse the log; each entry shows who changed what, in form layout.',
      'Open a metric_value change to see Dimension → Theme → Metric → Site → Period and the old vs new value.',
      'Click Restore to bring a record back; if a record already exists you will be asked to confirm before overwriting.',
    ],
    stepsTh: [
      'เลื่อนดูบันทึก — แต่ละรายการแสดงว่าใครเปลี่ยนอะไร แบบฟอร์มอ่านง่าย',
      'เปิดรายการ metric_value เพื่อดู มิติ → หัวข้อ → ตัวชี้วัด → สถานที่ → รอบ และค่าก่อน/หลัง',
      'กด Restore เพื่อกู้คืน — หากมีข้อมูลอยู่แล้วระบบจะถามยืนยันก่อนเขียนทับ',
    ],
  },
  {
    key: 'backup-data', section: 'admin', icon: HardDrive,
    titleEn: 'Backup Data', titleTh: 'สำรองข้อมูล',
    introEn: 'Export your tenant data for safekeeping or offline analysis.',
    introTh: 'ส่งออกข้อมูลขององค์กรเพื่อสำรองไว้ หรือนำไปวิเคราะห์นอกระบบ',
    stepsEn: ['Choose what to export and download the file.'],
    stepsTh: ['เลือกสิ่งที่จะส่งออกและดาวน์โหลดไฟล์'],
  },
];

const SECTION_META = {
  main:   { en: 'Main Menu',      th: 'เมนูหลัก',     icon: '📊' },
  master: { en: 'Master Data',    th: 'ข้อมูลหลัก',    icon: '🗂️' },
  admin:  { en: 'Administration', th: 'การจัดการระบบ', icon: '⚙️' },
} as const;

export default function HelpCenter() {
  const { language } = useLanguage();
  const { canSeeMenu, hasFeature } = useMenuPermissions();
  const { role } = useAuth();
  const th = language === 'th';

  // Only show guides for menus this user/tenant can actually access.
  const visibleGuides = useMemo(
    () => GUIDES.filter(g => canSeeMenu(g.key) && (!g.feature || hasFeature(g.feature))),
    [canSeeMenu, hasFeature],
  );

  const bySection = (section: Guide['section']) =>
    visibleGuides.filter(g => g.section === section);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <span className="p-2 bg-primary/10 rounded-xl inline-flex">
            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </span>
          {th ? 'ศูนย์ช่วยเหลือ — คู่มือการใช้งาน' : 'Help Center — User Guide'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {th
            ? 'สอนการใช้งานเรียงตามเมนูด้านซ้าย — แสดงเฉพาะฟีเจอร์ที่องค์กรของคุณมีสิทธิ์ใช้งาน'
            : 'A step-by-step guide ordered by the sidebar — showing only the features your organisation has access to.'}
        </p>
      </div>

      {/* Getting started */}
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4 text-emerald-600" />
            {th ? 'เริ่มต้นใช้งาน (สำหรับผู้ใช้ใหม่)' : 'Getting Started (for new users)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-700 space-y-2">
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>{th ? 'ผู้ดูแล (Admin) ตั้งค่า ข้อมูลหลัก ก่อน: บริษัท → สถานที่ → รอบรายงาน → มิติ → หัวข้อ → ตัวชี้วัด' : 'An Admin sets up the master data first: Companies → Sites → Reporting Periods → Dimensions → Themes → Metrics.'}</li>
            <li>{th ? 'ตั้ง เป้าหมาย KPI ให้ตัวชี้วัดที่ต้องการติดตาม' : 'Set KPI Targets for the metrics you want to track.'}</li>
            <li>{th ? 'พนักงาน (Staff) กรอกข้อมูลที่หน้า บันทึกข้อมูล (Data Entry) ทุกเดือน' : 'Staff record values in Data Entry each month.'}</li>
            <li>{th ? 'ผู้บริหารและผู้เกี่ยวข้องดูผลที่ Dashboard, ESG Key Issues และ Reports' : 'Executives and stakeholders review results in the Dashboard, ESG Key Issues and Reports.'}</li>
          </ol>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            {th
              ? `บทบาทของคุณ: ${role ?? '—'} — คู่มือด้านล่างแสดงเฉพาะเมนูที่คุณเข้าถึงได้`
              : `Your role: ${role ?? '—'} — the guide below shows only the menus you can access.`}
          </p>
        </CardContent>
      </Card>

      {/* Guides by section */}
      {(['main', 'master', 'admin'] as const).map(section => {
        const items = bySection(section);
        if (items.length === 0) return null;
        const meta = SECTION_META[section];
        return (
          <div key={section} className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span>{meta.icon}</span>{th ? meta.th : meta.en}
            </h2>
            <Card>
              <CardContent className="p-0">
                <Accordion type="multiple" className="w-full">
                  {items.map(g => {
                    const Icon = g.icon;
                    const steps = th ? g.stepsTh : g.stepsEn;
                    const tip = th ? g.tipTh : g.tipEn;
                    return (
                      <AccordionItem key={g.key} value={g.key} className="px-4">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3 text-left">
                            <span className="rounded-lg bg-emerald-100 p-1.5 shrink-0 inline-flex">
                              <Icon className="h-4 w-4 text-emerald-700" />
                            </span>
                            <span>
                              <span className="block text-sm font-semibold text-foreground">{th ? g.titleTh : g.titleEn}</span>
                              <span className="block text-xs text-muted-foreground font-normal">{th ? g.introTh : g.introEn}</span>
                            </span>
                            {g.feature && (
                              <Badge variant="outline" className="ml-1 text-[9px] border-amber-300 text-amber-700 bg-amber-50 shrink-0">
                                {th ? 'ฟีเจอร์เสริม' : 'Add-on'}
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-11 pb-2 space-y-2.5">
                            <ol className="list-decimal pl-4 space-y-1.5 text-sm text-slate-700">
                              {steps.map((s, i) => <li key={i}>{s}</li>)}
                            </ol>
                            {tip && (
                              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                                <Lightbulb className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-800">{tip}</p>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground text-center pt-2">
        {th
          ? '💡 ไม่เห็นเมนูที่ต้องการ? อาจเป็นเพราะสิทธิ์ของบทบาทคุณ หรือฟีเจอร์ยังไม่เปิดใช้ — ติดต่อผู้ดูแลระบบ'
          : '💡 Missing a menu? It may be restricted by your role, or the feature isn’t enabled — contact your administrator.'}
      </p>
    </div>
  );
}
