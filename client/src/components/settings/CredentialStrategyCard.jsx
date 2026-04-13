import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Loader2, Play, Lock, Trash2, Undo2 } from 'lucide-react';
import PasswordInput from '@/components/common/PasswordInput';
import ConfirmModal from '@/components/common/ConfirmModal';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes efficiently using clsx and tailwind-merge.
 *
 * @param {...(string|boolean|null|undefined)} inputs - A list of class names or conditional class objects.
 * @returns {string} The merged and optimised class string.
 */
function cn(...inputs) { return twMerge(clsx(inputs)); }

/**
 * A component for managing and verifying credential strategies for system outputs.
 *
 * @param {Object} props - The component properties.
 * @param {Object} props.strategy - The strategy configuration object.
 * @param {Object} props.initialValues - The initial credential values.
 * @param {boolean} props.verified - Whether the credentials are currently verified.
 * @param {Function} props.onSave - Callback function triggered when saving credentials.
 * @returns {JSX.Element} The rendered credential strategy card.
 */
export default function CredentialStrategyCard({ strategy, initialValues, verified, onSave }) {
    const [verifying, setVerifying] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showSafetyWarning, setShowSafetyWarning] = useState(false);
    const [result, setResult] = useState(null);
    const [showResetModal, setShowResetModal] = useState(false);
    const [values, setValues] = useState(initialValues || {});
    const [verifiedOverride, setVerifiedOverride] = useState(null);
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    // Reset the local override when the server-provided `verified` prop changes.
    // This avoids the "derived state in useEffect" anti-pattern by comparing
    // against the previous prop value during render.
    const prevVerifiedRef = useRef(verified);
    if (prevVerifiedRef.current !== verified) {
        prevVerifiedRef.current = verified;
        setVerifiedOverride(null);
    }

    // Derive isVerified: use local override when set, otherwise fall back to prop.
    const isVerified = verifiedOverride !== null ? verifiedOverride : (verified || false);

    // Sync local state when server config finishes loading.
    // Uses JSON.stringify for stable deep comparison.
    const initialValuesJson = JSON.stringify(initialValues || {});
    useEffect(() => {
        const parsed = JSON.parse(initialValuesJson);
        // Populate the fields whenever server values change.
        // We also reset isDirty because these values now match the server.
        setValues(parsed);
        setIsDirty(false);
    }, [initialValuesJson]);

    const { id, label, params } = strategy;
    const sensitiveParams = params.filter(p => p.sensitive);

    const handleParamChange = (key, value) => {
        const newValues = { ...values, [key]: value };
        setValues(newValues);
        setIsDirty(true);
        setVerifiedOverride(false);
        setResult(null);
    };

    const handleDiscard = () => {
        setValues(initialValues || {});
        setIsDirty(false);
        setVerifiedOverride(null);
        setResult(null);
    };

    const handleReset = async () => {
        setShowResetModal(true);
    };

    const confirmReset = async () => {
        setShowResetModal(false);
        const newValues = { ...values };
        // Empty all sensitive parameters to prepare for a reset.
        sensitiveParams.forEach(p => newValues[p.key] = '');
        setValues(newValues);
        setIsDirty(true);
        
        setSaving(true);
        try {
            // Pass 'true' to indicate this is a reset operation specifically.
            await onSave(newValues, true); 
            setVerifiedOverride(false);
            setResult({ success: true, message: 'Credentials Cleared' });
        } catch (e) {
            setResult({ success: false, message: e.message || 'Reset Failed' });
        } finally {
            setSaving(false);
        }
    };

    const handleVerifyTrigger = () => {
        setShowSafetyWarning(true);
    };

    const proceedWithVerification = async () => {
        setShowSafetyWarning(false);
        setVerifying(true);
        setResult(null);
        try {
            const endpoint = `/api/system/outputs/${id}/verify`;
            // Trigger a server-side verification test (e.g. sending a test sound).
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || 'Verification trigger failed');
            }
            
            // Show the confirmation modal only if the server-side test was initiated successfully.
            setShowConfirm(true);
        } catch (e) {
            setResult({ success: false, message: e.message });
        } finally {
            setVerifying(false);
        }
    };

    const handleConfirmSuccess = async () => {
        setShowConfirm(false);
        setSaving(true);
        try {
            // Once the user confirms they heard the test, persist the validated credentials to the backend.
            const res = await onSave(values, false);
            if (res.success) {
                setVerifiedOverride(true);
                setResult({ success: true, message: 'Verified & Saved' });
            } else {
                setResult({ success: false, message: res.error || 'Save Failed' });
            }
        } catch(e) {
            setResult({ success: false, message: e.message });
        } finally {
            setSaving(false);
        }
    };

    if (sensitiveParams.length === 0) return null;

    // Check if ALL sensitive params are empty in the *original* server values (not local state).
    const originallyEmpty = sensitiveParams.every(p => !initialValues?.[p.key]);
    const allEmpty = sensitiveParams.every(p => !values[p.key]);

    return (
        <div className="bg-app-card p-6 rounded-lg border border-app-border shadow-md">
            <div className="flex items-center justify-between mb-4 border-b border-app-border pb-4">
                <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    {label} Credentials
                </h3>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDiscard}
                        disabled={!isDirty || saving}
                        title="Discard Changes"
                        className="p-1.5 text-app-dim hover:text-app-text hover:bg-app-card-hover rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-app-dim"
                    >
                        <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleReset}
                        disabled={originallyEmpty || saving}
                        title="Reset / Clear Credentials"
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-colors disabled:opacity-50"
                    >
                        {saving && allEmpty ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {sensitiveParams.map(param => (
                    <div key={param.key}>
                        <label className="block text-sm font-medium text-app-text mb-1">
                            {param.label}
                        </label>
                        <PasswordInput 
                            value={values[param.key] || ''}
                            onChange={v => handleParamChange(param.key, v)}
                            placeholder={`Enter ${param.label}`}
                        />
                    </div>
                ))}

                <div className="pt-4 flex flex-wrap gap-3 items-center border-t border-app-border mt-4">
                    <button 
                        onClick={handleVerifyTrigger}
                        disabled={isVerified || verifying || allEmpty || saving}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded transition-colors text-sm font-medium disabled:opacity-50",
                            isVerified 
                                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/50 cursor-default" 
                                : "bg-amber-600/20 text-amber-400 hover:bg-amber-600/30"
                        )}
                    >
                        {verifying || saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isVerified ? (
                            <CheckCircle className="w-4 h-4" />
                        ) : (
                            <Play className="w-4 h-4" />
                        )}
                        {isVerified ? 'Verified & Saved' : (saving ? 'Saving...' : 'Test & Verify')}
                    </button>

                    {result && !isVerified && !result.success && (
                        <div className="text-sm flex items-center gap-2 text-red-400">
                            <XCircle className="w-4 h-4" />
                            {result.message}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal 
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleConfirmSuccess}
                title="Audio Verification"
                message={`Did you hear the test message from ${label}?`}
                confirmText="Yes, Verified"
                cancelText="No, Try Again"
                isDestructive={false}
            />

            <ConfirmModal 
                isOpen={showSafetyWarning}
                onClose={() => setShowSafetyWarning(false)}
                onConfirm={proceedWithVerification}
                title="Audio Warning"
                message="This will play audio through your connected output device (e.g., Alexa, speakers). Make sure the volume is at an appropriate level before proceeding."
                confirmText="I Understand, Proceed"
                cancelText="Cancel"
                isDestructive={false}
            />

            <ConfirmModal 
                isOpen={showResetModal}
                onClose={() => setShowResetModal(false)}
                onConfirm={confirmReset}
                title="Clear Credentials"
                message="Are you sure you want to clear these credentials? This will remove them from the system."
                confirmText="Clear Credentials"
                cancelText="Cancel"
                isDestructive={true}
            />
        </div>
    );
}
