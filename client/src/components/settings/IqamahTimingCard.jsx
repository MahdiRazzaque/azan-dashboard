import React, { useState } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
 * A component for configuring Iqamah timing rules for a specific prayer.
 *
 * @param {Object} props - Component props
 * @param {string} props.activeTab - The currently selected prayer (e.g., 'fajr', 'dhuhr')
 * @param {Object} props.currentPrayerSettings - The settings object for the current prayer
 * @param {Function} props.updatePrayerConfig - Function to update a specific setting key
 * @param {Array} props.providers - List of available prayer time providers
 * @param {Object} props.sources - The current source configuration (primary and backup)
 * @param {boolean} props.isDirty - Whether the settings have unsaved changes
 * @returns {JSX.Element|null} The rendered component, or null if activeTab is 'sunrise'
 */
export default function IqamahTimingCard({
  activeTab,
  currentPrayerSettings,
  updatePrayerConfig,
  providers,
  sources,
  isDirty,
}) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (activeTab === "sunrise") return null;

  const primaryType = sources?.primary?.type;
  const backupSource = sources?.backup;
  const primaryProvider = providers.find((p) => p.id === primaryType);
  const backupProvider = backupSource?.enabled
    ? providers.find((p) => p.id === backupSource.type)
    : null;

  const primaryProvidesIqamah =
    primaryProvider?.capabilities?.providesIqamah === true;
  const backupProvidesIqamah =
    backupProvider?.capabilities?.providesIqamah === true;
  const anyProvidesIqamah = primaryProvidesIqamah || backupProvidesIqamah;
  const backupEnabled = backupSource?.enabled === true;

  let bannerConfig = {
    type: "blue",
    icon: Info,
    text: "",
  };

  if (!primaryProvidesIqamah && !backupProvidesIqamah) {
    // Group A: Neither source provides Iqamah (includes backup disabled with non-providing primary)
    bannerConfig = {
      type: "blue",
      icon: Info,
      text: "Calculating Iqamah times locally. These settings apply to all sources.",
    };
  } else if (primaryProvidesIqamah && backupProvidesIqamah) {
    // Group B: Both sources provide Iqamah
    if (currentPrayerSettings.iqamahOverride) {
      bannerConfig = {
        type: "amber",
        icon: AlertTriangle,
        text: "Override active. Local calculation settings apply to both sources.",
      };
    } else {
      bannerConfig = {
        type: "green",
        icon: CheckCircle,
        text: `Following source Iqamah schedule from ${primaryProvider?.label || primaryType}. Both sources provide Iqamah times.`,
      };
    }
  } else if (primaryProvidesIqamah && !backupProvidesIqamah) {
    // Group C: Primary provides Iqamah, backup either disabled or doesn't provide
    if (currentPrayerSettings.iqamahOverride) {
      bannerConfig = {
        type: "amber",
        icon: AlertTriangle,
        text: backupEnabled
          ? "Override active. Local calculation settings apply to both sources."
          : `Override active. Using local calculation instead of ${primaryProvider?.label || primaryType} schedule.`,
      };
    } else {
      bannerConfig = backupEnabled
        ? {
            type: "green",
            icon: CheckCircle,
            text: `Following primary source Iqamah schedule from ${primaryProvider?.label || primaryType}. Local calculation settings below apply to backup source only.`,
          }
        : {
            type: "green",
            icon: CheckCircle,
            text: `Following source Iqamah schedule from ${primaryProvider?.label || primaryType}.`,
          };
    }
  } else if (!primaryProvidesIqamah && backupProvidesIqamah) {
    // Group D: Backup provides Iqamah, primary does not (backup must be enabled to reach here)
    if (currentPrayerSettings.iqamahOverride) {
      bannerConfig = {
        type: "amber",
        icon: AlertTriangle,
        text: "Override active. Local calculation settings apply to both sources.",
      };
    } else {
      bannerConfig = {
        type: "blue",
        icon: Info,
        text: "Primary source does not provide Iqamah times. Local calculation settings below apply to primary source only. Backup source uses its own schedule.",
      };
    }
  }

  const BannerIcon = bannerConfig.icon;

  return (
    <div className="bg-app-card border border-app-border rounded-xl overflow-hidden transition-all">
      {/* Header / Toggle Area */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-5 hover:bg-app-card-hover/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-emerald-500" />
          <h4 className="text-sm font-semibold text-app-text flex items-center gap-2 uppercase tracking-tight">
            Iqamah Timing
            {isDirty && (
              <span
                data-testid="dirty-dot"
                className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"
              />
            )}
          </h4>
        </div>
        <div className="flex items-center gap-2 text-app-dim group-hover:text-app-text transition-colors">
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="px-5 pb-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            data-testid="iqamah-banner"
            className={cn(
              "rounded-lg p-3 flex items-start gap-3 border",
              bannerConfig.type === "blue" &&
                "bg-blue-900/20 border-blue-800/50 text-blue-300",
              bannerConfig.type === "green" &&
                "bg-emerald-900/20 border-emerald-800/50 text-emerald-300",
              bannerConfig.type === "amber" &&
                "bg-amber-900/20 border-amber-800/50 text-amber-300",
            )}
          >
            <BannerIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{bannerConfig.text}</p>
          </div>

          {anyProvidesIqamah && (
            <div className="flex items-center justify-between pb-3 border-b border-app-border">
              <div>
                <label className="text-xs font-medium text-app-dim">
                  Override source schedule
                </label>
                <p className="text-[10px] text-app-dim mt-0.5">
                  Calculate iqamah locally
                </p>
              </div>
              <button
                role="switch"
                aria-checked={currentPrayerSettings.iqamahOverride}
                onClick={(e) => {
                  e.stopPropagation();
                  updatePrayerConfig(
                    "iqamahOverride",
                    !currentPrayerSettings.iqamahOverride,
                  );
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  currentPrayerSettings.iqamahOverride
                    ? "bg-emerald-600"
                    : "bg-app-card-hover"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-app-text transition duration-200 ease-in-out ${
                    currentPrayerSettings.iqamahOverride
                      ? "translate-x-5"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          )}

          {!(
            (primaryProvidesIqamah &&
              backupProvidesIqamah &&
              !currentPrayerSettings.iqamahOverride) ||
            (primaryProvidesIqamah &&
              !backupEnabled &&
              !currentPrayerSettings.iqamahOverride)
          ) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] text-app-dim font-bold uppercase tracking-wider">
                  Mode
                </label>
                <div className="grid grid-cols-2 gap-1 bg-app-bg/20 p-1 rounded-lg border border-app-border">
                  <button
                    onClick={() => updatePrayerConfig("fixedTime", null)}
                    className={`py-1.5 text-[11px] font-medium rounded transition-all ${
                      currentPrayerSettings.fixedTime === null
                        ? "bg-emerald-600 text-app-text shadow-lg"
                        : "text-app-dim hover:text-app-text"
                    }`}
                  >
                    Offset
                  </button>
                  <button
                    onClick={() => updatePrayerConfig("fixedTime", "12:00")}
                    className={`py-1.5 text-[11px] font-medium rounded transition-all ${
                      currentPrayerSettings.fixedTime !== null
                        ? "bg-emerald-600 text-app-text shadow-lg"
                        : "text-app-dim hover:text-app-text"
                    }`}
                  >
                    Fixed
                  </button>
                </div>
              </div>

              {currentPrayerSettings.fixedTime === null ? (
                <>
                  <div>
                    <label
                      htmlFor="iqamahOffset"
                      className="block text-[10px] text-app-dim font-bold uppercase tracking-wider mb-2"
                    >
                      Offset (minutes)
                    </label>
                    <input
                      id="iqamahOffset"
                      type="number"
                      value={currentPrayerSettings.iqamahOffset}
                      onChange={(e) =>
                        updatePrayerConfig(
                          "iqamahOffset",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="w-full bg-app-bg border border-app-border rounded p-2 text-sm text-app-text focus:outline-none focus:border-emerald-500 mt-2"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="roundTo"
                      className="block text-[10px] text-app-dim font-bold uppercase tracking-wider mb-2"
                    >
                      Round to nearest
                    </label>
                    <input
                      id="roundTo"
                      type="number"
                      value={currentPrayerSettings.roundTo}
                      onChange={(e) =>
                        updatePrayerConfig(
                          "roundTo",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="w-full bg-app-bg border border-app-border rounded p-2 text-sm text-app-text focus:outline-none focus:border-emerald-500 mt-2"
                    />
                  </div>
                </>
              ) : (
                <div className="md:col-span-2">
                  <label
                    htmlFor="fixedTime"
                    className="block text-[10px] text-app-dim font-bold uppercase tracking-wider mb-2"
                  >
                    Fixed Time (HH:MM)
                  </label>
                  <input
                    id="fixedTime"
                    type="time"
                    value={currentPrayerSettings.fixedTime}
                    onChange={(e) =>
                      updatePrayerConfig("fixedTime", e.target.value)
                    }
                    className="w-full bg-app-bg border border-app-border rounded p-2 text-sm text-app-text [color-scheme:dark] focus:outline-none focus:border-emerald-500 transition-colors mt-1"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
