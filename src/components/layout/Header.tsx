import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, User, LogOut, Building2, Menu } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  onMenuToggle?: () => void;
}

const roleConfig = {
  admin: { 
    label: 'Administrator',
    className: 'bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 shadow-lg shadow-red-500/25'
  },
  executive: { 
    label: 'Executive',
    className: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 shadow-lg shadow-emerald-500/25'
  },
  supervisor: { 
    label: 'Supervisor',
    className: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg shadow-amber-500/25'
  },
  staff: { 
    label: 'Staff',
    className: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 shadow-lg shadow-blue-500/25'
  },
  guest: { 
    label: 'Guest',
    className: 'bg-gray-100 text-gray-600 border border-gray-200'
  },
};

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, profile, role, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const handleLogout = async () => {
    await signOut();
  };

  const roleInfo = role ? roleConfig[role] : null;

  return (
    <header className="sticky top-0 z-10 flex h-14 sm:h-16 items-center justify-between border-b border-gray-200/50 bg-white/70 backdrop-blur-xl px-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-9 w-9 bg-white/80 backdrop-blur rounded-xl border border-gray-200/50"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5 text-gray-600" />
        </Button>

        <div className="flex flex-col">
          <h1 className="text-sm sm:text-base font-semibold text-gray-900 line-clamp-1">
            👋 {t('welcome')}, <span className="text-emerald-600">{profile?.full_name || user?.email?.split('@')[0]}</span>
          </h1>
          {(profile?.company_name || profile?.site_location) && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
              <Building2 className="h-3 w-3" />
              <span>{[profile?.company_name, profile?.site_location].filter(Boolean).join(' • ')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Role Badge - Always visible */}
        {role && roleInfo && (
          <Badge className={`${roleInfo.className} text-[10px] sm:text-xs px-2.5 py-1 rounded-full font-medium`}>
            {t(role)}
          </Badge>
        )}

        {/* Notification Bell */}
        <NotificationBell />

        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-1 sm:gap-2 text-gray-600 hover:text-gray-900 h-8 sm:h-9 px-2 sm:px-3 bg-white/80 backdrop-blur rounded-xl border border-gray-200/50 hover:bg-white hover:border-gray-300"
            >
              <Globe className="h-4 w-4" />
              <span className="text-xs sm:text-sm">{language === 'th' ? 'TH' : 'EN'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-32 bg-white/80 backdrop-blur-xl border-gray-200/50 rounded-xl">
            <DropdownMenuItem onClick={() => setLanguage('th')} className="gap-2 rounded-lg">
              🇹🇭 ไทย
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage('en')} className="gap-2 rounded-lg">
              🇺🇸 English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Info - Hidden on small screens */}
        <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/80 backdrop-blur border border-gray-200/50 pl-3 pr-1.5 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm">
            <User className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-700">
            {profile?.full_name || user?.email?.split('@')[0]}
          </span>
        </div>

        {/* Logout Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="gap-1 sm:gap-2 text-gray-500 hover:text-red-600 hover:bg-red-50/80 h-8 sm:h-9 px-2 sm:px-3 rounded-xl"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline text-xs sm:text-sm">{language === 'th' ? 'ออกจากระบบ' : 'Logout'}</span>
        </Button>
      </div>
    </header>
  );
}
