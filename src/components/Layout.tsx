import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Package, Search, Box as BoxIcon, Home, ScanLine, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const BottomNav = () => {
  const navItems = [
    { to: '/pack', icon: Package, label: 'Pack' },
    { to: '/scan', icon: ScanLine, label: 'Scan' },
    { to: '/find-item', icon: Search, label: 'Find' },
    { to: '/all-boxes', icon: BoxIcon, label: 'Boxes' },
    { to: '/', icon: Home, label: 'Home' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[72px] bg-white border-t border-[#E6E0F0] flex items-center justify-around px-4 z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95",
              isActive ? "text-[#6D4CFF]" : "text-[#8B849E]"
            )
          }
        >
          <Icon size={24} />
          <span className="text-[11px] font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export const Layout = ({ children, title, showBack = false }: { children: React.ReactNode, title?: string, showBack?: boolean }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const shouldShowBack = location.pathname !== '/' && location.pathname !== '/pack';

  return (
    <div className="min-h-screen bg-[#F6F4FB] pb-[80px]">
      {title && (
        <header className="sticky top-0 bg-white/80 backdrop-blur-md z-40 px-6 py-4 flex items-center gap-3 border-b border-[#E6E0F0]">
          {shouldShowBack && (
            <button
              onClick={() => navigate(-1)}
              className="h-11 w-11 -ml-2 rounded-full text-[#5F5A72] hover:bg-[#F1EFF8] active:scale-95 transition-all flex items-center justify-center shrink-0"
              aria-label="Go back"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <h1 className="text-lg font-semibold text-[#17142A]">{title}</h1>
        </header>
      )}
      <main className="p-5 max-w-[500px] mx-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
};