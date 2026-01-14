import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { NavLink, Outlet } from 'react-router-dom';
import { 
    Menu, X, Settings, Clock, Zap, FileAudio, 
    Terminal, LogOut, ChevronLeft, User, Save, RotateCcw
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function SettingsLayout({ logs }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [notification, setNotification] = useState(null);

  const { logout } = useAuth();
  const { 
    config,
    draftConfig,
    hasUnsavedChanges, 
    saveSettings, 
    resetToDefaults, 
    isSectionDirty, 
    resetDraft,
    saving 
  } = useSettings();

  useEffect(() => {
    return () => {
        resetDraft();
    }
  }, []);

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
        const timer = setTimeout(() => {
            setNotification(null);
        }, 5000);
        return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleGlobalSave = async () => {
      const result = await saveSettings();
      if (result.success) {
          if (result.warning) {
              setNotification({ 
                  type: 'warning', 
                  message: 'Settings saved, but some invalid automations were disabled.',
                  details: result.warningsList
              });
          } else {
              setNotification({ type: 'success', message: 'All settings saved successfully.' });
          }
      } else {
          setNotification({ type: 'error', message: 'Failed to save settings: ' + (result.error || 'Unknown error') });
      }
  };

  const handleGlobalReset = async () => {
      const result = await resetToDefaults();
      if (result.success) {
          setNotification({ type: 'success', message: 'Factory defaults restored.' });
      } else {
          setNotification({ type: 'error', message: 'Reset failed: ' + result.error });
      }
  };
  
  const navItems = [
    { 
        to: '/settings/general', 
        label: 'General', 
        icon: Settings, 
        isDirty: () => isSectionDirty('location') || isSectionDirty('sources')
    },
    { 
        to: '/settings/prayers', 
        label: 'Prayers', 
        icon: Clock, 
        isDirty: () => isSectionDirty('prayers') || isSectionDirty('calculation') || isSectionDirty('automation.triggers')
    },
    { 
        to: '/settings/automation', 
        label: 'Automation', 
        icon: Zap, 
        isDirty: () => {
            if (!config || !draftConfig) return false;
            const cAuth = config.automation || {};
            const dAuth = draftConfig.automation || {};
            // Compare automation excluding triggers
            const { triggers: t1, ...rest1 } = cAuth;
            const { triggers: t2, ...rest2 } = dAuth;
            return JSON.stringify(rest1) !== JSON.stringify(rest2);
        }
    },
    { 
        to: '/settings/files', 
        label: 'File Manager', 
        icon: FileAudio, 
        isDirty: () => false
    },
    { 
        to: '/settings/account', 
        label: 'Account', 
        icon: User, 
        isDirty: () => isSectionDirty('auth')
    },
    { 
        to: '/settings/developer', 
        label: 'Developer', 
        icon: Terminal, 
        isDirty: () => isSectionDirty('data')
    },
  ];

  const unsaved = hasUnsavedChanges();

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
        "fixed inset-y-0 left-0 z-30 w-64 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col flex-1 min-h-0">
            <div className="h-16 flex items-center px-6 border-b border-zinc-800 shrink-0">
                <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
                    Azan Dashboard
                </span>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isDirty = item.isDirty();
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                                isActive 
                                    ? "bg-emerald-500/10 text-emerald-500" 
                                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="flex-1">{item.label}</span>
                            {isDirty && (
                                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Actions Section */}
            <div className="p-4 border-t border-zinc-800 space-y-2 shrink-0">
                <button
                    onClick={handleGlobalSave}
                    disabled={!unsaved || saving}
                    className={cn(
                        "flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-bold rounded-md transition-all",
                        unsaved 
                            ? "bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-900/20" 
                            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    )}
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : (unsaved ? 'Save All' : 'No Changes')}
                </button>

                <button
                    onClick={() => setShowResetConfirm(true)}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 rounded-md transition-colors"
                >
                    <RotateCcw className="w-4 h-4" />
                    Reset to Default
                </button>
            </div>

            <div className="p-4 border-t border-zinc-800 shrink-0">
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Notification Toast */}
        {notification && (
            <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-xl border backdrop-blur-md animate-in slide-in-from-top-2 fade-in max-w-lg w-full ${
                notification.type === 'success' 
                ? 'bg-emerald-900/80 border-emerald-700/50 text-emerald-100' 
                : notification.type === 'warning'
                ? 'bg-amber-900/90 border-amber-700/50 text-amber-100'
                : 'bg-red-900/80 border-red-700/50 text-red-100'
            }`}>
                <div className="flex items-start gap-3">
                    <p className="text-sm font-medium pt-0.5">{notification.message}</p>
                    <button 
                         onClick={() => setNotification(null)}
                         className="ml-auto text-current opacity-70 hover:opacity-100"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                {notification.details && notification.details.length > 0 && (
                    <ul className="mt-2 text-xs opacity-90 list-disc list-inside space-y-1 pl-1 bg-black/20 p-2 rounded">
                        {notification.details.map((detail, i) => (
                            <li key={i}>{detail}</li>
                        ))}
                    </ul>
                )}
            </div>
        )}

        <ConfirmModal 
            isOpen={showResetConfirm}
            onClose={() => setShowResetConfirm(false)}
            onConfirm={handleGlobalReset}
            title="Reset to Defaults?"
            message="Are you sure you want to reset all settings to Factory Defaults? This action cannot be undone and will erase all your custom configuration."
            confirmText="Yes, Reset Everything"
            isDestructive={true}
        />

        {/* Top Header (Mobile Only / Breadcrumbs) */}

        <header className="h-16 flex items-center justify-between lg:justify-end px-6 border-b border-zinc-800 bg-zinc-950 shrink-0">
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
