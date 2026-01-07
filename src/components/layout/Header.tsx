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
import { Globe, User, LogOut } from 'lucide-react';

const roleColors = {
  admin: 'bg-destructive text-destructive-foreground',
  executive: 'bg-primary text-primary-foreground',
  supervisor: 'bg-accent text-accent-foreground border border-border',
  staff: 'bg-secondary text-secondary-foreground',
  guest: 'bg-muted text-muted-foreground',
};

export function Header() {
  const { user, profile, role, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground">
          {t('welcome')}, {profile?.full_name || user?.email}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Globe className="h-4 w-4" />
              {language === 'th' ? 'ไทย' : 'EN'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLanguage('th')}>
              ไทย (Thai)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage('en')}>
              English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Info & Role Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {profile?.full_name || user?.email?.split('@')[0]}
            </span>
          </div>
          {role && (
            <Badge className={roleColors[role]}>
              {t(role)}
            </Badge>
          )}
        </div>

        {/* Logout Button */}
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
          <LogOut className="h-4 w-4" />
          {language === 'th' ? 'ออกจากระบบ' : 'Logout'}
        </Button>
      </div>
    </header>
  );
}
