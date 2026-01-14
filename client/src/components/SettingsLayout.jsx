import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { NavLink, Outlet } from 'react-router-dom';
import { 
    Menu, X, Settings, Clock, Zap, FileAudio, 
    Terminal, LogOut, ChevronLeft, User
} from 'lucide-react';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function SettingsLayout({ logs }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout } = useAuth();
  
  const navItems = [
    { to: '/settings/general', label: 'General', icon: Settings },
    { to: '/settings/prayers', label: 'Prayers', icon: Clock },
    { to: '/settings/automation', label: 'Automation', icon: Zap },
    { to: '/settings/files', label: 'File Manager', icon: FileAudio },
    { to: '/settings/account', label: 'Account', icon: User },
    { to: '/settings/developer', label: 'Developer', icon: Terminal },
  ];

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
            <div className="h-16 flex items-center px-6 border-b border-zinc-800">
                <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
                    Azan Dashboard
                </span>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) => cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                            isActive 
                                ? "bg-emerald-500/10 text-emerald-500" 
                                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                        )}
                    >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-zinc-800">
                <button 
                    onClick={logout}
                    className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Logout
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header (Mobile Only / Breadcrumbs) */}
        <header className="h-16 flex items-center justify-between lg:justify-end px-6 border-b border-zinc-800 bg-zinc-950">
            <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 text-zinc-400 hover:text-white lg:hidden"
            >
                <Menu className="w-6 h-6" />
            </button>
            
            <div className="hidden lg:block">
                 <NavLink to="/" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
                    <ChevronLeft className="w-4 h-4" />
                    Back to Dashboard
                 </NavLink>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
            <Outlet context={{ logs }} />
        </main>
      </div>
    </div>
  );
}
