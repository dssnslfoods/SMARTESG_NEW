import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Database,
  FileInput,
  CheckSquare,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function Sidebar() {
  const { pathname } = useLocation();
  const { role, signOut } = useAuth();
  const { t } = useLanguage();
  const [masterDataOpen, setMasterDataOpen] = useState(pathname.startsWith('/master'));

  const navItems = [
    {
      label: t('dashboard'),
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'executive', 'supervisor', 'staff', 'guest'],
    },
    {
      label: t('dataEntry'),
      href: '/data-entry',
      icon: FileInput,
      roles: ['admin', 'staff'],
    },
    {
      label: t('review'),
      href: '/review',
      icon: CheckSquare,
      roles: ['admin', 'supervisor'],
    },
    {
      label: t('reports'),
      href: '/reports',
      icon: BarChart3,
      roles: ['admin', 'executive', 'supervisor'],
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
      roles: ['admin'],
    },
    {
      label: t('auditLog'),
      href: '/audit-log',
      icon: History,
      roles: ['admin'],
    },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            ESG
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">{t('appName')}</span>
            <span className="text-xs text-muted-foreground">{t('version')}</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems
          .filter((item) => item.roles.includes(role || ''))
          .map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}

        {role === 'admin' && (
          <Collapsible open={masterDataOpen} onOpenChange={setMasterDataOpen}>
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  pathname.startsWith('/master')
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4" />
                  {t('masterData')}
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    masterDataOpen && 'rotate-180'
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pl-4 pt-1">
              {masterDataItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive(item.href)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {adminItems
          .filter((item) => item.roles.includes(role || ''))
          .map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </Button>
      </div>
    </aside>
  );
}
