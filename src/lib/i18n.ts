// Internationalization - Thai/English translations

export type Language = 'th' | 'en';

export const translations = {
  th: {
    // Navigation
    home: 'หน้าหลัก',
    dashboard: 'แดชบอร์ด',
    masterData: 'ข้อมูลหลัก',
    dataEntry: 'บันทึกข้อมูล',
    review: 'ตรวจสอบ/อนุมัติ',
    reports: 'รายงาน',
    users: 'จัดการผู้ใช้',
    auditLog: 'บันทึกการใช้งาน',
    logout: 'ออกจากระบบ',
    login: 'เข้าสู่ระบบ',
    signup: 'สมัครสมาชิก',
    
    // Roles
    admin: 'ผู้ดูแลระบบ',
    executive: 'ผู้บริหาร',
    supervisor: 'หัวหน้างาน',
    staff: 'พนักงาน',
    
    // Master Data
    company: 'บริษัท',
    companies: 'บริษัท',
    site: 'สถานที่',
    sites: 'สถานที่',
    reportingPeriod: 'รอบระยะเวลา',
    reportingPeriods: 'รอบระยะเวลา',
    dimension: 'มิติ',
    dimensions: 'มิติ ESG',
    theme: 'หัวข้อ',
    themes: 'หัวข้อ ESG',
    metric: 'ตัวชี้วัด',
    metrics: 'ตัวชี้วัด ESG',
    
    // Fields
    companyId: 'รหัสบริษัท',
    companyName: 'ชื่อบริษัท',
    industry: 'อุตสาหกรรม',
    country: 'ประเทศ',
    siteId: 'รหัสสถานที่',
    siteName: 'ชื่อสถานที่',
    location: 'ที่ตั้ง',
    periodId: 'รหัสรอบระยะเวลา',
    year: 'ปี',
    month: 'เดือน',
    monthName: 'ชื่อเดือน',
    dimensionId: 'รหัสมิติ',
    dimensionName: 'ชื่อมิติ',
    themeId: 'รหัสหัวข้อ',
    themeName: 'ชื่อหัวข้อ',
    metricId: 'รหัสตัวชี้วัด',
    metricName: 'ชื่อตัวชี้วัด',
    unit: 'หน่วย',
    value: 'ค่า',
    dataSource: 'แหล่งข้อมูล',
    remark: 'หมายเหตุ',
    
    // Status
    status: 'สถานะ',
    draft: 'ร่าง',
    submitted: 'ส่งแล้ว',
    approved: 'อนุมัติแล้ว',
    rejected: 'ปฏิเสธ',
    
    // Actions
    save: 'บันทึก',
    saveDraft: 'บันทึกร่าง',
    submit: 'ส่งตรวจสอบ',
    approve: 'อนุมัติ',
    reject: 'ปฏิเสธ',
    edit: 'แก้ไข',
    delete: 'ลบ',
    cancel: 'ยกเลิก',
    search: 'ค้นหา',
    filter: 'กรอง',
    export: 'ส่งออก',
    exportExcel: 'ส่งออก Excel',
    exportPdf: 'ส่งออก PDF',
    add: 'เพิ่ม',
    create: 'สร้าง',
    update: 'อัปเดต',
    view: 'ดู',
    back: 'กลับ',
    
    // Auth
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    confirmPassword: 'ยืนยันรหัสผ่าน',
    fullName: 'ชื่อ-นามสกุล',
    forgotPassword: 'ลืมรหัสผ่าน?',
    rememberMe: 'จดจำฉัน',
    noAccount: 'ยังไม่มีบัญชี?',
    hasAccount: 'มีบัญชีแล้ว?',
    
    // Messages
    success: 'สำเร็จ',
    error: 'เกิดข้อผิดพลาด',
    loading: 'กำลังโหลด...',
    noData: 'ไม่มีข้อมูล',
    confirmDelete: 'คุณแน่ใจหรือไม่ที่จะลบ?',
    required: 'จำเป็น',
    invalidEmail: 'อีเมลไม่ถูกต้อง',
    passwordMismatch: 'รหัสผ่านไม่ตรงกัน',
    
    // Dashboard
    totalCompanies: 'จำนวนบริษัท',
    totalSites: 'จำนวนสถานที่',
    totalMetrics: 'จำนวนตัวชี้วัด',
    pendingApprovals: 'รออนุมัติ',
    completionRate: 'อัตราความสำเร็จ',
    recentActivity: 'กิจกรรมล่าสุด',
    quickActions: 'การดำเนินการด่วน',
    mySubmissions: 'รายการของฉัน',
    
    // App
    appName: 'ESG Smart Performance',
    version: 'v1.0',
    welcome: 'ยินดีต้อนรับ',
    selectLanguage: 'เลือกภาษา',
  },
  en: {
    // Navigation
    home: 'Home',
    dashboard: 'Dashboard',
    masterData: 'Master Data',
    dataEntry: 'Data Entry',
    review: 'Review & Approval',
    reports: 'Reports',
    users: 'User Management',
    auditLog: 'Audit Log',
    logout: 'Logout',
    login: 'Login',
    signup: 'Sign Up',
    
    // Roles
    admin: 'Administrator',
    executive: 'Executive',
    supervisor: 'Supervisor',
    staff: 'Staff',
    
    // Master Data
    company: 'Company',
    companies: 'Companies',
    site: 'Site',
    sites: 'Sites',
    reportingPeriod: 'Reporting Period',
    reportingPeriods: 'Reporting Periods',
    dimension: 'Dimension',
    dimensions: 'ESG Dimensions',
    theme: 'Theme',
    themes: 'ESG Themes',
    metric: 'Metric',
    metrics: 'ESG Metrics',
    
    // Fields
    companyId: 'Company ID',
    companyName: 'Company Name',
    industry: 'Industry',
    country: 'Country',
    siteId: 'Site ID',
    siteName: 'Site Name',
    location: 'Location',
    periodId: 'Period ID',
    year: 'Year',
    month: 'Month',
    monthName: 'Month Name',
    dimensionId: 'Dimension ID',
    dimensionName: 'Dimension Name',
    themeId: 'Theme ID',
    themeName: 'Theme Name',
    metricId: 'Metric ID',
    metricName: 'Metric Name',
    unit: 'Unit',
    value: 'Value',
    dataSource: 'Data Source',
    remark: 'Remark',
    
    // Status
    status: 'Status',
    draft: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
    rejected: 'Rejected',
    
    // Actions
    save: 'Save',
    saveDraft: 'Save Draft',
    submit: 'Submit for Review',
    approve: 'Approve',
    reject: 'Reject',
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    exportExcel: 'Export Excel',
    exportPdf: 'Export PDF',
    add: 'Add',
    create: 'Create',
    update: 'Update',
    view: 'View',
    back: 'Back',
    
    // Auth
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    fullName: 'Full Name',
    forgotPassword: 'Forgot Password?',
    rememberMe: 'Remember Me',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    
    // Messages
    success: 'Success',
    error: 'Error',
    loading: 'Loading...',
    noData: 'No data',
    confirmDelete: 'Are you sure you want to delete?',
    required: 'Required',
    invalidEmail: 'Invalid email',
    passwordMismatch: 'Passwords do not match',
    
    // Dashboard
    totalCompanies: 'Total Companies',
    totalSites: 'Total Sites',
    totalMetrics: 'Total Metrics',
    pendingApprovals: 'Pending Approvals',
    completionRate: 'Completion Rate',
    recentActivity: 'Recent Activity',
    quickActions: 'Quick Actions',
    mySubmissions: 'My Submissions',
    
    // App
    appName: 'ESG Smart Performance',
    version: 'v1.0',
    welcome: 'Welcome',
    selectLanguage: 'Select Language',
  },
} as const;

export type TranslationKey = keyof typeof translations.th;

export function t(key: TranslationKey, lang: Language): string {
  return translations[lang][key] || key;
}
