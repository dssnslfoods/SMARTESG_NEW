// ─── Shared menu configuration ────────────────────────────────────────────────
// Single source of truth for all sidebar menu items and their default permissions.
// Used by MenuPermissionsContext (runtime) and MenuPermission page (management UI).

export type AppRole = 'admin' | 'supervisor' | 'executive' | 'staff' | 'guest' | 'super_admin';
export const NON_ADMIN_ROLES: AppRole[] = ['supervisor', 'executive', 'staff', 'guest'];

export interface MenuItemConfig {
  key: string;            // matches DB menu_key and href (without leading /)
  label: string;          // English label
  labelTh: string;        // Thai label
  section: 'main' | 'master' | 'admin';
}

export const MENU_ITEMS: MenuItemConfig[] = [
  // ── Main Menu ──────────────────────────────────────────────────────────────
  { key: 'dashboard',             label: 'Dashboard',       labelTh: 'แดชบอร์ด',         section: 'main' },
  { key: 'esg-key-issues',        label: 'ESG Key Issues',  labelTh: 'ESG Key Issues',    section: 'main' },
  { key: 'data-entry',            label: 'Data Entry',      labelTh: 'บันทึกข้อมูล',      section: 'main' },
  { key: 'reports',               label: 'Reports',         labelTh: 'รายงาน',            section: 'main' },
  { key: 'reports/environmental', label: 'Environmental',   labelTh: 'สิ่งแวดล้อม',       section: 'main' },
  { key: 'reports/social',        label: 'Social',          labelTh: 'สังคม',             section: 'main' },
  { key: 'reports/governance',    label: 'Governance',      labelTh: 'ธรรมาภิบาล',        section: 'main' },
  { key: 'reports/ghg',           label: 'GHG Emissions',   labelTh: 'การปล่อย GHG',      section: 'main' },
  { key: 'reports/esg-overview',  label: 'ESG Overview',    labelTh: 'ESG Overview',      section: 'main' },

  // ── Master Data ────────────────────────────────────────────────────────────
  { key: 'master/companies',        label: 'Companies',       labelTh: 'บริษัท',           section: 'master' },
  { key: 'master/sites',            label: 'Sites',           labelTh: 'สถานที่',           section: 'master' },
  { key: 'master/periods',          label: 'Periods',         labelTh: 'รอบรายงาน',        section: 'master' },
  { key: 'master/dimensions',       label: 'Dimensions',      labelTh: 'มิติ ESG',          section: 'master' },
  { key: 'master/themes',           label: 'Themes',          labelTh: 'หัวข้อหลัก',        section: 'master' },
  { key: 'master/metrics',          label: 'Metrics',         labelTh: 'ตัวชี้วัด',         section: 'master' },
  { key: 'master/targets',          label: 'KPI Targets',     labelTh: 'เป้าหมาย KPI',     section: 'master' },
  { key: 'master/ghg-settings',     label: 'GHG Settings',    labelTh: 'ตั้งค่า GHG',       section: 'master' },
  { key: 'master/menu-permissions', label: 'Menu Permissions',labelTh: 'สิทธิ์เมนู',        section: 'master' },
  { key: 'master/data-entry-permissions', label: 'Data Entry Permissions', labelTh: 'สิทธิ์บันทึกข้อมูล', section: 'master' },
  { key: 'master/settings',         label: 'System Settings', labelTh: 'ตั้งค่าระบบ',       section: 'master' },

  // ── Administration ─────────────────────────────────────────────────────────
  { key: 'users',       label: 'User Management', labelTh: 'จัดการผู้ใช้',     section: 'admin' },
  { key: 'audit-log',   label: 'Audit Log',        labelTh: 'บันทึกกิจกรรม',   section: 'admin' },
  { key: 'backup-data', label: 'Backup Data',      labelTh: 'สำรองข้อมูล',      section: 'admin' },
  { key: 'help-center', label: 'Help Center',      labelTh: 'ศูนย์ช่วยเหลือ',   section: 'admin' },
];

// ── Fallback defaults (used when DB hasn't loaded yet) ─────────────────────
// admin always has access to everything — not listed here.
export const DEFAULT_PERMISSIONS: Record<string, AppRole[]> = {
  'dashboard':              ['supervisor', 'executive', 'guest'],
  'esg-key-issues':         ['supervisor', 'executive', 'staff', 'guest'],
  'data-entry':             ['supervisor', 'staff'],
  'reports':                ['executive'],
  'reports/environmental':  ['executive'],
  'reports/social':         ['executive'],
  'reports/governance':     ['executive'],
  'reports/ghg':            ['executive'],
  'reports/esg-overview':   ['executive'],
  'master/companies':       ['supervisor'],
  'master/sites':           ['supervisor'],
  'master/periods':         ['supervisor'],
  'master/dimensions':      ['supervisor'],
  'master/themes':          ['supervisor'],
  'master/metrics':         ['supervisor'],
  'master/targets':         ['supervisor', 'executive', 'staff'],
  'master/ghg-settings':    [],
  'master/menu-permissions':[],
  'master/data-entry-permissions':[],
  'master/settings':        [],
  'users':                  ['supervisor', 'executive', 'staff', 'guest'],
  'audit-log':              [],
  'backup-data':            [],
  'help-center':            ['supervisor'],
};
