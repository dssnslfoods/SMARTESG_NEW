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
      roles: ['admin', 'executive', 'supervisor', 'guest'],
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
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
        <Link to="/dashboard" className="flex items-center gap-3 group" onClick={onNavigate}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm transition-transform group-hover:scale-105">
            <Leaf className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground tracking-tight">
              {language === 'th' ? 'ESG Performance' : 'ESG Performance'}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {language === 'th' ? 'ระบบจัดการความยั่งยืน' : 'Sustainability Platform'}
            </span>
          </div>
        </Link>
        
        {/* Close button for mobile */}
        {showCloseButton && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onNavigate}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive(item.href)
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive(item.href) && "text-primary")} />
                    {item.label}
                  </Link>
                  
                  {/* Report Settings Sub-menu - only show when on reports page */}
                  {isOnReportsPage && (
                    <Collapsible open={reportSettingsOpen} onOpenChange={setReportSettingsOpen}>
                      <CollapsibleTrigger asChild>
                        <button
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 ml-4 mt-1 text-sm transition-all duration-200',
                            'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Settings className="h-3.5 w-3.5" />
                            {language === 'th' ? 'จัดการ Card' : 'Manage Cards'}
                          </div>
                          <ChevronDown
                            className={cn(
                              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
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
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all hover:bg-sidebar-accent/50"
                          >
                            <Checkbox 
                              checked={section.visible} 
                              className="h-3.5 w-3.5"
                              onCheckedChange={() => toggleSection(section.id)}
                            />
                            <span className={cn(
                              "text-muted-foreground",
                              section.visible && "text-sidebar-foreground"
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
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-50"
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
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive(item.href)
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive(item.href) && "text-primary")} />
                {item.label}
              </Link>
            );
          })}

        {/* Master Data Section */}
        {(role === 'admin' || role === 'supervisor' || role === 'guest') && (
          <>
            <div className="mb-2 mt-6 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {language === 'th' ? 'ข้อมูลหลัก' : 'Master Data'}
              </span>
            </div>

            <Collapsible open={masterDataOpen} onOpenChange={setMasterDataOpen}>
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isGuest 
                      ? 'text-muted-foreground cursor-not-allowed opacity-50'
                      : pathname.startsWith('/master')
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                  disabled={isGuest}
                >
                  <div className="flex items-center gap-3">
                    <Database className={cn("h-4 w-4", pathname.startsWith('/master') && "text-primary")} />
                    {t('masterData')}
                  </div>
                  {!isGuest && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform duration-200',
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
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200',
                        isActive(item.href)
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
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
            <div className="mb-2 mt-6 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {language === 'th' ? 'การจัดการระบบ' : 'Administration'}
              </span>
            </div>

            {adminItems
              .filter((item) => item.roles.includes(role || ''))
              .map((item) => 
                isGuest ? (
                  <div
                    key={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-50"
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
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive(item.href)
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive(item.href) && "text-primary")} />
                    {item.label}
                  </Link>
                )
              )}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </Button>
      </div>
    </aside>
  );
}