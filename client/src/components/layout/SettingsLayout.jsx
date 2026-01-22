import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
    Menu, X, Settings, Clock, Zap, FileAudio, 
    Terminal, LogOut, ChevronLeft, Shield, Save, RotateCcw, AlertTriangle
} from 'lucide-react';
import ConfirmModal from '@/components/common/ConfirmModal';
import SaveProcessModal from '@/components/common/SaveProcessModal';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * A utility function for conditionally joining CSS classes using tailwind-merge and clsx.
 *
 * @param {...any} inputs - The class names or objects to merge.
 * @returns {string} The merged class string.
 */
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * A layout component for the settings pages, providing a sidebar navigation,
 * header area, and a common state for handling configuration saves and resets.
 *
 * @param {object} props - The component props.
 * @param {Array} props.logs - Array of log messages to display or process.
 * @param {object} props.processStatus - Real-time status update for ongoing processes.
 * @returns {JSX.Element} The rendered settings layout component.
 */
export default function SettingsLayout({ logs, processStatus }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // Process Modal State
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  const { logout } = useAuth();
  const { 
    config,
    draftConfig,
    systemHealth,
    hasUnsavedChanges, 
    saveSettings, 
    resetToDefaults, 
    isSectionDirty, 
    getSectionHealth,
    resetDraft,
    saving,
    validateBeforeSave
  } = useSettings();

  const location = useLocation();

  useEffect(() => {
    return () => {
        resetDraft();
    }
  }, [resetDraft]);

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
      // Validate before opening modal
      if (validateBeforeSave) {
          const check = validateBeforeSave();
          if (!check.success) {
              setNotification({ type: 'error', message: check.error });
              return;
          }
      }

      setShowProcessModal(true);
      setSaveResult(null);
      
      // Wait a small tick to ensure modal opens before heavy lifting (if any synchronous blocking occurs)
      await new Promise(r => setTimeout(r, 100));

      const result = await saveSettings();
      setSaveResult(result);
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
            // Compare automation excluding triggers and voiceMonkey (since VM is now separate)
            const { triggers: t1, voiceMonkey: v1, ...rest1 } = cAuth;
            const { triggers: t2, voiceMonkey: v2, ...rest2 } = dAuth;
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
        to: '/settings/credentials', 
        label: 'Credentials', 
        icon: Shield, 
        isDirty: () => false // Credentials have their own save button
    },
    { 
        to: '/settings/developer', 
        label: 'Developer', 
        icon: Terminal, 
        isDirty: () => isSectionDirty('data')
    },
  ];

  // Helper to get health for a specific nav item
  const getItemHealth = (item) => {
      if (item.health) return item.health();
      
      // Prayers: Show warnings for ANY bad trigger config
      if (item.label === 'Prayers') {
          return getSectionHealth('automation.triggers');
      }
      
      // Automation
      if (item.label === 'Automation') {
          // VoiceMonkey health is now relevant to Credentials page, but maybe keep here or move?
          // PRD doesn't strictly say where to show health, but "Automation" view still has logical automation settings.
          // However, VoiceMonkey credentials are in Credentials view.
          // Let's keep it clean for now.
          return { healthy: true, issues: [] };
      }

      if (item.label === 'Credentials') {
          // User requested no warning if VoiceMonkey is not set up
          return { healthy: true, issues: [] };
      }
      
      return { healthy: true, issues: [] };
  };

  const unsaved = hasUnsavedChanges();
  
  // Context-Aware Header: Logic to hide global save controls
  const isGlobalSaveVisible = !['/settings/credentials', '/settings/files', '/settings/developer'].some(path => location.pathname.includes(path));

  return (
    <div className="flex h-screen bg-app-bg text-app-text font-sans">
      <SaveProcessModal 
          isOpen={showProcessModal} 
          onClose={() => setShowProcessModal(false)} 
          processStatus={processStatus}
          result={saveResult}
      />
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
            className="fixed inset-0 z-20 bg-app-bg/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 bg-app-card border-r border-app-border transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col flex-1 min-h-0">
            <div className="h-16 flex items-center px-6 border-b border-app-border shrink-0">
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
                                    : "text-app-dim hover:bg-app-card-hover hover:text-app-text"
                            )}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="flex-1">{item.label}</span>
                            {!getItemHealth(item).healthy && (
                                <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse mr-1" />
                            )}
                            {isDirty && (
                                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Actions Section Removed - Moved to Header */}
            
            <div className="p-4 border-t border-app-border shrink-0 mt-auto">
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
                    <ul className="mt-2 text-xs opacity-90 list-disc list-inside space-y-1 pl-1 bg-app-bg/20 p-2 rounded">
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

        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-app-border bg-app-bg shrink-0">
             <div className="flex items-center gap-4">
                <button 
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 -ml-2 text-app-dim hover:text-app-text lg:hidden"
                >
                    <Menu className="w-6 h-6" />
                </button>
                
                <div className="flex items-center">
                     <NavLink to="/" className="flex items-center gap-1.5 lg:gap-2 text-[10px] lg:text-sm font-bold uppercase tracking-tight lg:capitalize lg:font-normal text-app-dim hover:text-app-text transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Back to Dashboard</span>
                        <span className="sm:hidden">Dashboard</span>
                     </NavLink>
                </div>
             </div>

             <div className="flex items-center gap-2">
                {/* Global Actions - Conditionally Rendered */}
                {isGlobalSaveVisible && (
                    <>
                        {/* Discard Changes */}
                        {unsaved && (
                            <button
                                onClick={resetDraft}
                                disabled={saving}
                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
                                title="Discard all unsaved changes"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}

                        {/* Reset to Defaults */}
                        <button
                            onClick={() => setShowResetConfirm(true)}
                            disabled={saving}
                            className="p-2 text-app-dim hover:bg-app-card-hover hover:text-app-text rounded-full transition-colors"
                            title="Reset to Factory Defaults"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>

                        {/* Save All */}
                        <button
                            onClick={handleGlobalSave}
                            disabled={!unsaved || saving}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all text-sm",
                                unsaved 
                                    ? "bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-900/20" 
                                    : "bg-app-card-hover text-app-dim cursor-not-allowed"
                            )}
                            title={unsaved ? "Save all changes" : "No changes to save"}
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </>
                )}
             </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
            <Outlet context={{ logs }} />
        </main>
      </div>
    </div>
  );
}
