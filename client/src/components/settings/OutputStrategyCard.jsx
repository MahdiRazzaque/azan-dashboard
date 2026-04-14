import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Power,
  AlertTriangle,
  Volume2,
} from "lucide-react";
import AudioConsentModal from "./AudioConsentModal";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge tailwind classes.
 *
 * @param {...any} inputs - Class names or objects.
 * @returns {string} Merged class names.
 */
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Session-level consent storage
let sessionConsentGiven = false;

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-app-card border-transparent",
      checked ? "bg-emerald-600" : "bg-app-card-hover",
    )}
  >
    <span
      className={cn(
        "inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out",
        checked ? "translate-x-6" : "translate-x-1",
      )}
    />
  </button>
);

/**
 * A card component that displays and manages the settings for an output strategy.
 *
 * @param {Object} props - The component props.
 * @param {Object} props.strategy - The strategy metadata.
 * @param {Object} props.config - The current configuration for this strategy.
 * @param {Function} props.onChange - Callback fired when a configuration value changes.
 * @param {Object} props.systemHealth - The current health status of all output targets.
 * @returns {JSX.Element} The rendered component.
 */
export default function OutputStrategyCard({
  strategy,
  config,
  onChange,
  systemHealth,
}) {
  const [testingHealth, setTestingHealth] = useState(false);
  const [testingAudio, setTestingAudio] = useState(false);
  const [status, setStatus] = useState("idle"); // idle, testing, online, offline
  const [errorMsg, setErrorMsg] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const { id, label, params, hidden } = strategy;

  useEffect(() => {
    if (systemHealth && systemHealth[id]) {
      const health = systemHealth[id];
      if (health.healthy) {
        setStatus("online");
        setErrorMsg(null);
      } else {
        setStatus("offline");
        setErrorMsg(health.message || "Unknown error");
      }
    }
  }, [systemHealth, id]);

  if (hidden) return null;

  const values = config?.params || {};
  const enabled = config?.enabled ?? false;
  const leadTimeMs = config?.leadTimeMs ?? strategy.defaultLeadTimeMs ?? 0;

  // Global constraints for all strategies
  const minLead = -30000;
  const maxLead = 30000;
  const snapPoints = [
    -30000, -25000, -20000, -15000, -10000, -5000, 0, 5000, 10000, 15000, 20000,
    25000, 30000,
  ];
  const snapThreshold = 750;

  const handleParamChange = (key, value) => {
    onChange("params", { ...values, [key]: value });
    setStatus("idle"); // Reset status on change
  };

  const handleCheckHealth = async () => {
    setTestingHealth(true);
    setErrorMsg(null);

    try {
      // Using refreshHealth endpoint to trigger health check for specific target
      // Pass current values to allow testing unsaved changes
      const res = await fetch("/api/system/health/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: id,
          params: values,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.message || errData.error || "Health check failed",
        );
      }

      const data = await res.json();
      const healthData = data[id];

      if (healthData && healthData.healthy) {
        setStatus("online");
      } else {
        setStatus("offline");
        setErrorMsg(healthData?.message || "Unknown error");
      }
    } catch (e) {
      setStatus("offline");
      setErrorMsg(e.message);
    } finally {
      setTestingHealth(false);
    }
  };

  const handleTestAudioClick = () => {
    if (sessionConsentGiven) {
      triggerAudioTest();
    } else {
      setShowConsentModal(true);
    }
  };

  const handleConsentConfirm = (dontAskAgain) => {
    if (dontAskAgain) {
      sessionConsentGiven = true;
    }
    triggerAudioTest();
  };

  const triggerAudioTest = async () => {
    setTestingAudio(true);
    try {
      const res = await fetch(`/api/system/outputs/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          source: { path: "custom/test.mp3" },
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.message || errData.error || "Audio test failed",
        );
      }
    } catch (e) {
      console.error("Audio test failed:", e);
      // We don't necessarily want to change the health status just because a test failed
      // but we might want to show an alert or something.
    } finally {
      setTestingAudio(false);
    }
  };

  return (
    <div className="bg-app-card p-6 rounded-lg border border-app-border shadow-md">
      <div className="flex items-center justify-between mb-4 border-b border-app-border pb-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-app-text">{label}</h3>
              {enabled && status === "offline" && (
                <AlertTriangle
                  className="w-5 h-5 text-amber-500 animate-pulse"
                  title={errorMsg || "Service Offline"}
                />
              )}
            </div>
            <div className="text-xs text-app-dim mt-1">ID: {id}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-sm font-medium",
              enabled ? "text-emerald-400" : "text-app-dim",
            )}
          >
            {enabled ? "Active" : "Inactive"}
          </span>
          <Toggle checked={enabled} onChange={(v) => onChange("enabled", v)} />
        </div>
      </div>

      <div className="space-y-5">
        {/* Lead Time Config */}
        <div className="pt-2">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-app-text">
              Lead Time Adjustment
            </label>
            <span
              className={cn(
                "text-sm font-bold px-2 py-0.5 rounded",
                leadTimeMs > 0
                  ? "text-emerald-400 bg-emerald-400/10"
                  : leadTimeMs < 0
                    ? "text-amber-400 bg-amber-400/10"
                    : "text-app-dim bg-app-card-hover",
              )}
            >
              {leadTimeMs > 0
                ? `+${(leadTimeMs / 1000).toFixed(1)}s`
                : leadTimeMs < 0
                  ? `${(leadTimeMs / 1000).toFixed(1)}s`
                  : "Synchronised"}
            </span>
          </div>
          <div className="text-xs text-app-dim mb-3">
            {leadTimeMs > 0
              ? `Starts ${leadTimeMs}ms before target time.`
              : leadTimeMs < 0
                ? `Starts ${Math.abs(leadTimeMs)}ms after target time.`
                : "Starts exactly at target time."}
          </div>
          <div className="relative mt-4 mb-16">
            {/* Track Background */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-zinc-800 rounded-lg border border-white/5" />

            {/* Bidirectional Fill (Center to Thumb) */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-emerald-500/40 rounded-full transition-all duration-75"
              style={{
                left:
                  leadTimeMs >= 0
                    ? "50%"
                    : `${((leadTimeMs - minLead) / (maxLead - minLead)) * 100}%`,
                width: `${(Math.abs(leadTimeMs) / (maxLead - minLead)) * 100}%`,
              }}
            />

            {/* Markers */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-4 pointer-events-none px-0">
              <div className="relative w-full h-full">
                {snapPoints.map((p) => (
                  <div
                    key={p}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 w-[2px] rounded-full transition-all",
                      p === 0
                        ? "h-6 bg-emerald-500/80 z-20"
                        : "h-2 bg-white/10 z-10",
                    )}
                    style={{
                      left: `${((p - minLead) / (maxLead - minLead)) * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                ))}
              </div>
            </div>

            <input
              type="range"
              min={minLead}
              max={maxLead}
              step="100"
              value={leadTimeMs}
              onChange={(e) => {
                let val = parseInt(e.target.value) || 0;
                const nearest = snapPoints.reduce((prev, curr) =>
                  Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev,
                );
                if (Math.abs(val - nearest) < snapThreshold) {
                  val = nearest;
                }
                onChange("leadTimeMs", val);
              }}
              className="absolute inset-0 w-full h-1.5 bg-transparent appearance-none cursor-pointer z-30
                                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(16,185,129,0.5)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-900
                                [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-400 [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(16,185,129,0.5)] [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-zinc-900"
            />

            {/* High-visibility markers for precise alignment */}
            <div className="absolute top-7 left-0 right-0 h-4 text-[10px] text-app-dim select-none pointer-events-none">
              <span className="absolute left-0">Lag (-30s)</span>
              <span className="absolute left-1/2 -translate-x-1/2 font-medium text-app-text/60">
                0s
              </span>
              <span className="absolute right-0 text-right">Lead (+30s)</span>
            </div>
          </div>
        </div>

        {/* Strategy Params - Non-Sensitive Only */}
        {params.filter((p) => !p.sensitive).length > 0 && (
          <div className="space-y-4 pt-2">
            {params
              .filter((p) => !p.sensitive)
              .map((param) => (
                <div key={param.key}>
                  <label className="block text-sm font-medium text-app-text mb-1">
                    {param.label}
                    {param.requiredForHealth && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </label>
                  {param.type === "select" ? (
                    <select
                      value={values[param.key] || param.default || ""}
                      onChange={(e) =>
                        handleParamChange(param.key, e.target.value)
                      }
                      className="w-full bg-app-bg border border-app-border rounded p-2 text-app-text focus:ring-emerald-500 focus:border-emerald-500 mb-1 appearance-none cursor-pointer"
                    >
                      {param.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={values[param.key] || param.default || ""}
                      onChange={(e) =>
                        handleParamChange(param.key, e.target.value)
                      }
                      className="w-full bg-app-bg border border-app-border rounded p-2 text-app-text focus:ring-emerald-500 focus:border-emerald-500 mb-1"
                    />
                  )}
                  {param.subtext && (
                    <div className="text-xs text-app-dim italic ml-1">
                      {param.subtext}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 flex flex-wrap gap-3 items-center border-t border-app-border">
          <div className="relative group">
            <button
              onClick={handleCheckHealth}
              disabled={testingHealth || testingAudio}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded transition-colors text-sm font-medium disabled:opacity-50 min-w-[140px] justify-center",
                testingHealth
                  ? "bg-amber-600/20 text-amber-400 border border-amber-600/50"
                  : status === "online"
                    ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-600/50"
                    : status === "offline"
                      ? "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/50"
                      : "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30",
              )}
            >
              {testingHealth ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Checking...
                </>
              ) : status === "online" ? (
                <>
                  <CheckCircle className="w-4 h-4" /> Online
                </>
              ) : status === "offline" ? (
                <>
                  <XCircle className="w-4 h-4" /> Offline
                </>
              ) : (
                <>
                  <Power className="w-4 h-4" /> Check Health
                </>
              )}
            </button>

            {/* Error Tooltip */}
            {status === "offline" && errorMsg && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[250px] px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-700">
                <div className="font-semibold text-red-400 mb-0.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Connection Error
                </div>
                {errorMsg}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 border-b border-r border-gray-700 rotate-45"></div>
              </div>
            )}
          </div>

          <button
            onClick={handleTestAudioClick}
            disabled={testingHealth || testingAudio}
            className="flex items-center gap-2 px-4 py-2 rounded bg-app-card-hover text-app-text hover:bg-emerald-600/20 hover:text-emerald-400 border border-app-border hover:border-emerald-600/50 transition-all text-sm font-medium disabled:opacity-50 min-w-[140px] justify-center"
          >
            {testingAudio ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Triggering...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" /> Test Audio
              </>
            )}
          </button>
        </div>
      </div>

      <AudioConsentModal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        onConfirm={handleConsentConfirm}
        strategyLabel={label}
      />
    </div>
  );
}
