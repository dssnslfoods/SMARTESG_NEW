import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { PageTransition } from './PageTransition';
import { useTVMode } from '@/contexts/TVModeContext';
import { TrialBanner } from '@/components/plan/TrialBanner';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isTVMode } = useTVMode();

  // Enable realtime notifications for data changes
  useRealtimeNotifications();

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64 [&>button]:hidden">
          <Sidebar onNavigate={() => setMobileMenuOpen(false)} showCloseButton />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setMobileMenuOpen(true)} />
        <TrialBanner />
        <main className="flex-1 overflow-y-auto bg-gradient-subtle">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 sm:py-8">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </main>
      </div>

      {/* TV Mode fullscreen overlay — covers sidebar + header */}
      {isTVMode && (
        <div className="fixed inset-0 z-[9999] bg-background overflow-hidden flex flex-col">
          {children}
        </div>
      )}
    </div>
  );
}

