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

interface HeaderProps {
  onMenuToggle?: () => void;
}

const roleConfig = {
  admin: { 
    label: 'Administrator',
    className: 'bg-primary/15 text-primary border-primary/30'
  },
  executive: { 
    label: 'Executive',
    className: 'bg-[hsl(200_75%_50%/0.15)] text-[hsl(200_75%_40%)] border-[hsl(200_75%_50%/0.3)]'
  },
  supervisor: { 
    label: 'Supervisor',
    className: 'bg-[hsl(38_85%_55%/0.15)] text-[hsl(30_80%_35%)] border-[hsl(38_85%_55%/0.3)]'
  },
  staff: { 
    label: 'Staff',
    className: 'bg-secondary text-secondary-foreground border-border'
  },
  guest: { 
    label: 'Guest',
    className: 'bg-muted text-muted-foreground border-border'
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
    <header className="flex h-14 sm:h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-9 w-9"
          onClick={onMenuToggle}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex flex-col">
          <h1 className="text-sm sm:text-base font-semibold text-foreground line-clamp-1">
            {t('welcome')}, {profile?.full_name || user?.email?.split('@')[0]}
          </h1>
          {(profile?.company_name || profile?.site_location) && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span>{[profile?.company_name, profile?.site_location].filter(Boolean).join(' • ')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Role Badge - Always visible */}
        {role && roleInfo && (
          <Badge className={`${roleInfo.className} text-[10px] sm:text-xs px-2 py-0.5`}>
            {t(role)}
          </Badge>
        )}

        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 sm:gap-2 text-muted-foreground hover:text-foreground h-8 sm:h-9 px-2 sm:px-3">
              <Globe className="h-4 w-4" />
              <span className="text-xs sm:text-sm">{language === 'th' ? 'TH' : 'EN'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-32">
            <DropdownMenuItem onClick={() => setLanguage('th')} className="gap-2">
              🇹🇭 ไทย
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage('en')} className="gap-2">
              🇺🇸 English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Info - Hidden on small screens */}
        <div className="hidden sm:flex items-center gap-2 rounded-full bg-muted/50 pl-3 pr-1 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">
            {profile?.full_name || user?.email?.split('@')[0]}
          </span>
        </div>

        {/* Logout Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="gap-1 sm:gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 sm:h-9 px-2 sm:px-3"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline text-xs sm:text-sm">{language === 'th' ? 'ออกจากระบบ' : 'Logout'}</span>
        </Button>
      </div>
    </header>
  );
}