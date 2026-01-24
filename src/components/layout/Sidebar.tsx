import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Database,
  FileInput,
  BarChart3,
  Users,
  History,
  LogOut,
  HardDrive,
  Building2,
  MapPin,
  Calendar,
  Layers,
  Tag,
  Activity,
  Leaf,
  X,
  Settings,
  ChevronDown,
  Scale,
  Heart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import { useReportSections } from '@/contexts/ReportSectionsContext';
import { Checkbox } from '@/components/ui/checkbox';

interface SidebarProps {
  onNavigate?: () => void;
  showCloseButton?: boolean;
}

export function Sidebar({ onNavigate, showCloseButton = false }: SidebarProps) {
  const { pathname } = useLocation();
  const { role, signOut } = useAuth();
  const { t, language } = useLanguage();
  const [masterDataOpen, setMasterDataOpen] = useState(pathname.startsWith('/master'));
  const [reportSettingsOpen, setReportSettingsOpen] = useState(pathname === '/reports');
  
  const { sections, toggleSection } = useReportSections();

  const isGuest = role === 'guest';
  const isOnReportsPage = pathname === '/reports';

  const navItems = [
    {
      label: t('dashboard'),
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'executive', 'supervisor', 'guest'],
    },
    {
      label: t('dataEntry'),
      href: '/data-entry',
      icon: FileInput,
      roles: ['admin', 'supervisor', 'staff', 'guest'],
    },
    {
      label: t('reports'),
      href: '/reports',
      icon: BarChart3,
      roles: ['admin', 'executive'],
    },
    {
      label: language === 'th' ? 'สิ่งแวดล้อม' : 'Environmental',
      href: '/reports/environmental',
      icon: Leaf,
      roles: ['admin', 'executive'],
    },
    {
      label: language === 'th' ? 'สังคม' : 'Social',
      href: '/reports/social',
      icon: Heart,
      roles: ['admin', 'executive'],
    },
    {
      label: language === 'th' ? 'ธรรมาภิบาล' : 'Governance',
      href: '/reports/governance',
      icon: Scale,
      roles: ['admin', 'executive'],
    },
  ];

  const masterDataItems = [
    { label: t('companies'), href: '/master/companies', icon: Building2 },
    { label: t('sites'), href: '/master/sites', icon: MapPin },
    { label: t('reportingPeriods'), href: '/master/periods', icon: Calendar },
    { label: t('dimensions'), href: '/master/dimensions', icon: Layers },
    { label: t('themes'), href: '/master/themes', icon: Tag },
    { label: t('metrics'), href: '/master/metrics', icon: Activity },
  ];

  const adminItems = [
    {
      label: t('users'),
      href: '/users',
      icon: Users,
      roles: ['admin', 'supervisor', 'executive', 'staff', 'guest'],
    },
    {
      label: t('auditLog'),
      href: '/audit-log',
      icon: History,
      roles: ['admin', 'guest'],
    },
    {
      label: language === 'th' ? 'สำรองข้อมูล' : 'Backup Data',
      href: '/backup-data',
      icon: HardDrive,
      roles: ['admin'],
    },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="flex h-full w-64 flex-col bg-white/80 backdrop-blur-xl border-r border-gray-200/50">
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200/50 px-5">
        <Link to="/dashboard" className="flex items-center gap-3 group" onClick={onNavigate}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/25 transition-transform group-hover:scale-105">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900 tracking-tight">
              {language === 'th' ? 'ESG Performance' : 'ESG Performance'}
            </span>
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              {language === 'th' ? 'ระบบจัดการความยั่งยืน' : 'Sustainability Platform'}
            </span>
          </div>
        </Link>
        
        {/* Close button for mobile */}
        {showCloseButton && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-gray-700"
            onClick={onNavigate}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 px-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {language === 'th' ? 'เมนูหลัก' : 'Main Menu'}
          </span>
        </div>

        {navItems
          .filter((item) => item.roles.includes(role || ''))
          .map((item) => {
            // Reports menu with sub-menu for card settings
            if (item.href === '/reports' && !isGuest) {
              return (
                <div key={item.href}>
                  <Link
                    to={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-200/50 text-emerald-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100/80 border border-transparent'
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive(item.href) && "text-emerald-600")} />
                    {item.label}
                  </Link>
                  
                  {/* Report Settings Sub-menu - only show when on reports page */}
                  {isOnReportsPage && (
                    <Collapsible open={reportSettingsOpen} onOpenChange={setReportSettingsOpen}>
                      <CollapsibleTrigger asChild>
                        <button
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 ml-4 mt-1 text-sm transition-all duration-200',
                            'text-gray-400 hover:bg-gray-100/80 hover:text-gray-600'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Settings className="h-3.5 w-3.5" />
                            {language === 'th' ? 'จัดการ Card' : 'Manage Cards'}
                          </div>
                          <ChevronDown
                            className={cn(
                              'h-3.5 w-3.5 text-gray-400 transition-transform duration-200',
                              reportSettingsOpen && 'rotate-180'
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-1 pl-7 pt-1">
                        {sections.map((section) => (
                          <button
                            key={section.id}
                            onClick={() => toggleSection(section.id)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs transition-all hover:bg-gray-100/80"
                          >
                            <Checkbox 
                              checked={section.visible} 
                              className="h-3.5 w-3.5"
                              onCheckedChange={() => toggleSection(section.id)}
                            />
                            <span className={cn(
                              "text-gray-400",
                              section.visible && "text-gray-700"
                            )}>
                              {language === 'th' ? section.labelTh : section.labelEn}
                            </span>
                          </button>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              );
            }
            
            // Regular menu items
            return isGuest ? (
              <div
                key={item.href}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-400 cursor-not-allowed opacity-50"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
            ) : (
              <Link
                key={item.href}
                to={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 border',
                  isActive(item.href)
                    ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-200/50 text-emerald-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100/80 border-transparent'
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive(item.href) && "text-emerald-600")} />
                {item.label}
              </Link>
            );
          })}

        {/* Master Data Section */}
        {(role === 'admin' || role === 'supervisor' || role === 'guest') && (
          <>
            <div className="mb-3 mt-6 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {language === 'th' ? 'ข้อมูลหลัก' : 'Master Data'}
              </span>
            </div>

            <Collapsible open={masterDataOpen} onOpenChange={setMasterDataOpen}>
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 border',
                    isGuest 
                      ? 'text-gray-400 cursor-not-allowed opacity-50 border-transparent'
                      : pathname.startsWith('/master')
                        ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-200/50 text-emerald-700'
                        : 'text-gray-600 hover:bg-gray-100/80 border-transparent'
                  )}
                  disabled={isGuest}
                >
                  <div className="flex items-center gap-3">
                    <Database className={cn("h-4 w-4", pathname.startsWith('/master') && "text-emerald-600")} />
                    {t('masterData')}
                  </div>
                  {!isGuest && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-gray-400 transition-transform duration-200',
                        masterDataOpen && 'rotate-180'
                      )}
                    />
                  )}
                </button>
              </CollapsibleTrigger>
              {!isGuest && (
                <CollapsibleContent className="space-y-0.5 pl-4 pt-1">
                  {masterDataItems.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all duration-200',
                        isActive(item.href)
                          ? 'bg-emerald-50/80 text-emerald-700'
                          : 'text-gray-500 hover:bg-gray-100/80 hover:text-gray-700'
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Link>
                  ))}
                </CollapsibleContent>
              )}
            </Collapsible>
          </>
        )}

        {/* Admin Section */}
        {adminItems.filter((item) => item.roles.includes(role || '')).length > 0 && (
          <>
            <div className="mb-3 mt-6 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {language === 'th' ? 'การจัดการระบบ' : 'Administration'}
              </span>
            </div>

            {adminItems
              .filter((item) => item.roles.includes(role || ''))
              .map((item) => 
                isGuest ? (
                  <div
                    key={item.href}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-400 cursor-not-allowed opacity-50"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 border',
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-200/50 text-emerald-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100/80 border-transparent'
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive(item.href) && "text-emerald-600")} />
                    {item.label}
                  </Link>
                )
              )}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="border-t border-gray-200/50 p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-gray-500 hover:text-red-600 hover:bg-red-50/80 transition-colors rounded-xl"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </Button>
      </div>
    </aside>
  );
}
