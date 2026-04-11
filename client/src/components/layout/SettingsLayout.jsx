/* eslint-disable jsdoc/require-jsdoc */
import { useEffect, useRef, useCallback, useReducer } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Menu, X, Settings, Clock, Zap, FileAudio,
  Terminal, LogOut, ChevronLeft, Shield, Save, RotateCcw, AlertTriangle, Compass
} from 'lucide-react';
import ConfirmModal from '@/components/common/ConfirmModal';
import SaveProcessModal from '@/components/common/SaveProcessModal';
import { useTour } from '@/hooks/useTour';
import { adminTourSteps } from '@/config/tourSteps';
import WelcomeModal from '@/components/common/WelcomeModal';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const NAV_TOUR_IDS = {
  General: 'tour-nav-general',
  Prayers: 'tour-nav-prayers',
  Automation: 'tour-nav-automation',
  'File Manager': 'tour-nav-files',
  Credentials: 'tour-nav-credentials',
  Developer: 'tour-nav-developer',
};

const HIDDEN_GLOBAL_SAVE_PATHS = ['/settings/credentials', '/settings/files', '/settings/developer'];

const INITIAL_UI_STATE = {
  sidebarOpen: false,
  showResetConfirm: false,
  notification: null,
  showAdminTourModal: false,
  showProcessModal: false,
  saveResult: null,
};

/**
 * Utility to merge Tailwind class names conditionally.
 * @param {...*} inputs - Class values passed to clsx.
 * @returns {string} Merged class string.
 */
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function settingsUiReducer(state, action) {
  switch (action.type) {
    case 'SET_SIDEBAR_OPEN':
      return { ...state, sidebarOpen: action.payload };
    case 'SET_RESET_CONFIRM_OPEN':
      return { ...state, showResetConfirm: action.payload };
    case 'SET_NOTIFICATION':
      return { ...state, notification: action.payload };
    case 'SET_ADMIN_TOUR_MODAL_OPEN':
      return { ...state, showAdminTourModal: action.payload };
    case 'SET_PROCESS_MODAL_OPEN':
      return { ...state, showProcessModal: action.payload };
    case 'SET_SAVE_RESULT':
      return { ...state, saveResult: action.payload };
    default:
      return state;
  }
}

function getTourId(label) {
  return NAV_TOUR_IDS[label];
}

function buildNavItems({ isSectionDirty, config, draftConfig }) {
  return [
    {
      to: '/settings/general',
      label: 'General',
      icon: Settings,
      isDirty: () => isSectionDirty('location') || isSectionDirty('sources'),
    },
    {
      to: '/settings/prayers',
      label: 'Prayers',
      icon: Clock,
      isDirty: () => isSectionDirty('prayers') || isSectionDirty('automation.triggers'),
    },
    {
      to: '/settings/automation',
      label: 'Automation',
      icon: Zap,
      isDirty: () => {
        if (!config || !draftConfig) return false;
        const currentAutomation = config.automation || {};
        const draftAutomation = draftConfig.automation || {};
        const { triggers: _currentTriggers, outputs: _currentOutputs, ...currentRest } = currentAutomation;
        const { triggers: _draftTriggers, outputs: _draftOutputs, ...draftRest } = draftAutomation;
        return JSON.stringify(currentRest) !== JSON.stringify(draftRest) || isSectionDirty('automation.outputs');
      },
    },
    {
      to: '/settings/files',
      label: 'File Manager',
      icon: FileAudio,
      isDirty: () => false,
    },
    {
      to: '/settings/credentials',
      label: 'Credentials',
      icon: Shield,
      isDirty: () => false,
    },
    {
      to: '/settings/developer',
      label: 'Developer',
      icon: Terminal,
      isDirty: () => isSectionDirty('data'),
    },
  ];
}

function getNavItemHealth(item, { systemHealth, config, draftConfig, getSectionHealth }) {
  if (item.health) return item.health();

  if (item.label === 'General') {
    const issues = [];
    if (systemHealth?.primarySource && !systemHealth.primarySource.healthy) {
      issues.push({ type: 'Primary Source Offline' });
    }
    if (config?.sources?.backup?.enabled && systemHealth?.backupSource && !systemHealth.backupSource.healthy) {
      issues.push({ type: 'Backup Source Offline' });
    }
    return { healthy: issues.length === 0, issues };
  }

  if (item.label === 'Prayers') {
    return getSectionHealth('automation.triggers');
  }

  if (item.label === 'Automation') {
    const outputs = draftConfig?.automation?.outputs || {};
    const issues = [];
    Object.entries(outputs).forEach(([id, cfg]) => {
      if (cfg.enabled && systemHealth[id] && !systemHealth[id].healthy) {
        issues.push({ type: `${id} Offline` });
      }
    });
    return { healthy: issues.length === 0, issues };
  }

  if (item.label === 'Credentials') {
    return { healthy: true, issues: [] };
  }

  return { healthy: true, issues: [] };
}

function SettingsNavItem({ item, isDirty, isHealthy, onClick }) {
  return (
    <NavLink
      id={getTourId(item.label)}
      to={item.to}
      onClick={onClick}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative',
        isActive
          ? 'bg-emerald-500/10 text-emerald-500'
          : 'text-app-dim hover:bg-app-card-hover hover:text-app-text'
      )}
    >
      <item.icon className="w-5 h-5" />
      <span className="flex-1">{item.label}</span>
      {!isHealthy && <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse mr-1" />}
      {isDirty && <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />}
    </NavLink>
  );
}

function SettingsSidebar({
  sidebarOpen,
  navItems,
  getItemHealth,
  onClose,
  onRestartAdminTour,
  onLogout,
}) {
  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-app-bg/50 lg:hidden"
          onClick={onClose}
          aria-label="Close settings sidebar"
        />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 w-64 bg-app-card border-r border-app-border transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 flex flex-col',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="h-16 flex items-center px-6 border-b border-app-border shrink-0">
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
              Azan Dashboard
            </span>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const itemHealth = getItemHealth(item);
              return (
                <SettingsNavItem
                  key={item.to}
                  item={item}
                  isDirty={item.isDirty()}
                  isHealthy={itemHealth.healthy}
                  onClick={onClose}
                />
              );
            })}
          </nav>

          <div className="p-4 border-t border-app-border shrink-0 mt-auto">
            <button
              onClick={onRestartAdminTour}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-app-dim hover:bg-app-card-hover hover:text-app-text rounded-md transition-colors mb-2"
            >
              <Compass className="w-5 h-5" />
              Restart Tour
            </button>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function SettingsNotificationToast({ notification, onDismiss }) {
  if (!notification) return null;

  return (
    <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-xl border backdrop-blur-md animate-in slide-in-from-top-2 fade-in max-w-lg w-full ${
      notification.type === 'success'
        ? 'bg-emerald-900/80 border-emerald-700/50 text-emerald-100'
        : notification.type === 'warning'
          ? 'bg-amber-900/90 border-amber-700/50 text-amber-100'
          : 'bg-red-900/80 border-red-700/50 text-red-100'
    }`}>
      <div className="flex items-start gap-3">
        <p className="text-sm font-medium pt-0.5">{notification.message}</p>
        <button onClick={onDismiss} className="ml-auto text-current opacity-70 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      {notification.details && notification.details.length > 0 && (
        <ul className="mt-2 text-xs opacity-90 list-disc list-inside space-y-1 pl-1 bg-app-bg/20 p-2 rounded">
          {notification.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SettingsHeader({
  isGlobalSaveVisible,
  unsaved,
  saving,
  onOpenSidebar,
  onDiscard,
  onReset,
  onSave,
}) {
  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-app-border bg-app-bg shrink-0">
      <div className="flex items-center gap-4">
        <button onClick={onOpenSidebar} className="p-2 -ml-2 text-app-dim hover:text-app-text lg:hidden">
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex items-center">
          <NavLink
            to="/"
            className="flex items-center gap-1.5 lg:gap-2 text-[10px] lg:text-sm font-bold uppercase tracking-tight lg:capitalize lg:font-normal text-app-dim hover:text-app-text transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Dashboard</span>
          </NavLink>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isGlobalSaveVisible && (
          <>
            {unsaved && (
              <button
                onClick={onDiscard}
                disabled={saving}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
                title="Discard all unsaved changes"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onReset}
              disabled={saving}
              className="p-2 text-app-dim hover:bg-app-card-hover hover:text-app-text rounded-full transition-colors"
              title="Reset to Factory Defaults"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={onSave}
              disabled={!unsaved || saving}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all text-sm',
                unsaved
                  ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-900/20'
                  : 'bg-app-card-hover text-app-dim cursor-not-allowed'
              )}
              title={unsaved ? 'Save all changes' : 'No changes to save'}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        )}
      </div>
    </header>
  );
}

function SettingsResetConfirmModal({ open, onClose, onConfirm }) {
  return (
    <ConfirmModal
      isOpen={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Reset to Defaults?"
      message="Are you sure you want to reset all settings to Factory Defaults? This action cannot be undone and will erase all your custom configuration."
      confirmText="Yes, Reset Everything"
      isDestructive={true}
    />
  );
}

/**
 * Layout shell for the settings panel, providing the sidebar nav, global save/reset controls,
 * and the admin onboarding tour flow.
 * @param {object} props
 * @param {Array} [props.logs] - SSE log entries forwarded to the outlet.
 * @param {object} [props.processStatus] - Current process status for the save modal.
 * @returns {JSX.Element} The rendered settings layout.
 */
export default function SettingsLayout({ logs, processStatus }) {
  const [ui, dispatch] = useReducer(settingsUiReducer, INITIAL_UI_STATE);

  const { startTour, stopTour } = useTour();
  const adminTourStartedRef = useRef(false);
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
    validateBeforeSave,
    refresh,
  } = useSettings();

  const location = useLocation();
  const notificationTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      resetDraft();
    };
  }, [resetDraft]);

  useEffect(() => {
    if (!config?.system?.tours || config.system.tours.adminSeen !== false) return;
    if (adminTourStartedRef.current) return;
    adminTourStartedRef.current = true;
    requestAnimationFrame(() => dispatch({ type: 'SET_ADMIN_TOUR_MODAL_OPEN', payload: true }));
  }, [config]);

  useEffect(() => () => stopTour(), [stopTour]);

  const clearNotification = useCallback(() => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = null;
    }
    dispatch({ type: 'SET_NOTIFICATION', payload: null });
  }, []);

  const pushNotification = useCallback((nextNotification) => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }

    dispatch({ type: 'SET_NOTIFICATION', payload: nextNotification });

    if (nextNotification) {
      notificationTimerRef.current = setTimeout(() => {
        dispatch({ type: 'SET_NOTIFICATION', payload: null });
        notificationTimerRef.current = null;
      }, 5000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
        notificationTimerRef.current = null;
      }
    };
  }, []);

  const handleGlobalSave = async () => {
    if (validateBeforeSave) {
      const check = validateBeforeSave();
      if (!check.success) {
        pushNotification({ type: 'error', message: check.error });
        return;
      }
    }

    dispatch({ type: 'SET_PROCESS_MODAL_OPEN', payload: true });
    dispatch({ type: 'SET_SAVE_RESULT', payload: null });

    await new Promise((r) => setTimeout(r, 100));

    const result = await saveSettings();
    dispatch({ type: 'SET_SAVE_RESULT', payload: result });
  };

  const handleGlobalReset = async () => {
    const result = await resetToDefaults();
    if (result.success) {
      pushNotification({ type: 'success', message: 'Factory defaults restored.' });
    } else {
      pushNotification({ type: 'error', message: 'Reset failed: ' + result.error });
    }
  };

  const handleAdminTourComplete = useCallback(() => {
    fetch('/api/settings/tour-state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminSeen: true }),
    }).then(() => refresh()).catch(() => {});
  }, [refresh]);

  const handleStartAdminTour = useCallback(() => {
    dispatch({ type: 'SET_ADMIN_TOUR_MODAL_OPEN', payload: false });
    requestAnimationFrame(() => startTour('admin', adminTourSteps, handleAdminTourComplete));
  }, [startTour, handleAdminTourComplete]);

  const handleSkipAdminTour = useCallback(() => {
    fetch('/api/settings/tour-state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminSeen: true }),
    }).then(() => {
      dispatch({ type: 'SET_ADMIN_TOUR_MODAL_OPEN', payload: false });
      refresh();
    }).catch(() => {
      dispatch({ type: 'SET_ADMIN_TOUR_MODAL_OPEN', payload: false });
    });
  }, [refresh]);

  const handleRestartAdminTour = useCallback(() => {
    adminTourStartedRef.current = false;
    fetch('/api/settings/tour-state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminSeen: false }),
    }).then(() => {
      requestAnimationFrame(() => startTour('admin', adminTourSteps, handleAdminTourComplete));
    }).catch(() => {});
  }, [startTour, handleAdminTourComplete]);

  const unsaved = hasUnsavedChanges();
  const isGlobalSaveVisible = !HIDDEN_GLOBAL_SAVE_PATHS.some((path) => location.pathname.includes(path));
  const navItems = buildNavItems({ isSectionDirty, config, draftConfig });
  const getItemHealth = useCallback(
    (item) => getNavItemHealth(item, { systemHealth, config, draftConfig, getSectionHealth }),
    [systemHealth, config, draftConfig, getSectionHealth]
  );

  return (
    <div className="flex h-screen bg-app-bg text-app-text font-sans">
      <SaveProcessModal
        isOpen={ui.showProcessModal}
        onClose={() => dispatch({ type: 'SET_PROCESS_MODAL_OPEN', payload: false })}
        processStatus={processStatus}
        result={ui.saveResult}
      />

      {ui.showAdminTourModal && (
        <WelcomeModal
          onStartTour={handleStartAdminTour}
          onSkip={handleSkipAdminTour}
          title="Welcome to the Admin Panel"
          description="Take a quick tour to learn about the configuration sections and system management tools."
        />
      )}

      <SettingsSidebar
        sidebarOpen={ui.sidebarOpen}
        navItems={navItems}
        getItemHealth={getItemHealth}
        onClose={() => dispatch({ type: 'SET_SIDEBAR_OPEN', payload: false })}
        onRestartAdminTour={handleRestartAdminTour}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <SettingsNotificationToast notification={ui.notification} onDismiss={clearNotification} />

        <SettingsResetConfirmModal
          open={ui.showResetConfirm}
          onClose={() => dispatch({ type: 'SET_RESET_CONFIRM_OPEN', payload: false })}
          onConfirm={handleGlobalReset}
        />

        <SettingsHeader
          isGlobalSaveVisible={isGlobalSaveVisible}
          unsaved={unsaved}
          saving={saving}
          onOpenSidebar={() => dispatch({ type: 'SET_SIDEBAR_OPEN', payload: true })}
          onDiscard={resetDraft}
          onReset={() => dispatch({ type: 'SET_RESET_CONFIRM_OPEN', payload: true })}
          onSave={handleGlobalSave}
        />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ logs }} />
        </main>
      </div>
    </div>
  );
}
