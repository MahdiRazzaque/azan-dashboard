/* eslint-disable jsdoc/require-jsdoc */
import { useReducer, useEffect } from 'react';
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

const initialState = {
    verifying: false,
    showConfirm: false,
    showSafetyWarning: false,
    result: null,
    showResetModal: false,
    values: {},
    verificationState: null, // null = use prop `verified`; 'verified' | 'unverified' = local override
    isDirty: false,
    saving: false,
};

function reducer(state, action) {
    switch (action.type) {
        case 'SYNC_VALUES':
            return { ...state, values: action.values, isDirty: false };
        case 'PARAM_CHANGED':
            return { ...state, values: { ...state.values, [action.key]: action.value }, isDirty: true, verificationState: 'unverified', result: null };
        case 'DISCARD':
            return { ...state, values: action.values, isDirty: false, verificationState: null, result: null };
        case 'SHOW_RESET_MODAL':
            return { ...state, showResetModal: true };
        case 'HIDE_RESET_MODAL':
            return { ...state, showResetModal: false };
        case 'RESET_VALUES':
            return { ...state, showResetModal: false, values: action.values, isDirty: true, saving: true };
        case 'RESET_SUCCESS':
            return { ...state, saving: false, verificationState: 'unverified', result: { success: true, message: 'Credentials Cleared' } };
        case 'RESET_ERROR':
            return { ...state, saving: false, result: { success: false, message: action.message } };
        case 'SHOW_SAFETY_WARNING':
            return { ...state, showSafetyWarning: true };
        case 'HIDE_SAFETY_WARNING':
            return { ...state, showSafetyWarning: false };
        case 'START_VERIFY':
            return { ...state, showSafetyWarning: false, verifying: true, result: null };
        case 'VERIFY_TRIGGERED':
            return { ...state, verifying: false, showConfirm: true };
        case 'VERIFY_FAILED':
            return { ...state, verifying: false, result: { success: false, message: action.message } };
        case 'HIDE_CONFIRM':
            return { ...state, showConfirm: false };
        case 'START_SAVE':
            return { ...state, showConfirm: false, saving: true };
        case 'SAVE_VERIFIED':
            return { ...state, saving: false, verificationState: 'verified', result: { success: true, message: 'Verified & Saved' } };
        case 'SAVE_FAILED':
            return { ...state, saving: false, result: { success: false, message: action.message } };
        default:
            return state;
    }
}

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
    const [state, dispatch] = useReducer(reducer, {
        ...initialState,
        values: initialValues || {},
    });
    const { verifying, showConfirm, showSafetyWarning, result, showResetModal, values, verificationState, isDirty, saving } = state;

    // Sync local state when server config finishes loading.
    // Uses JSON.stringify for stable deep comparison.
    const initialValuesJson = JSON.stringify(initialValues || {});
    useEffect(() => {
        const parsed = JSON.parse(initialValuesJson);
        dispatch({ type: 'SYNC_VALUES', values: parsed });
    }, [initialValuesJson]);

    const { id, label, params } = strategy;
    const sensitiveParams = params.filter(p => p.sensitive);
    const isVerified = verificationState === null ? (verified || false) : verificationState === 'verified';

    const handleParamChange = (key, value) => {
        dispatch({ type: 'PARAM_CHANGED', key, value });
    };

    const handleDiscard = () => {
        dispatch({ type: 'DISCARD', values: initialValues || {} });
    };

    const handleReset = async () => {
        dispatch({ type: 'SHOW_RESET_MODAL' });
    };

    const confirmReset = async () => {
        const newValues = { ...values };
        sensitiveParams.forEach(p => newValues[p.key] = '');
        dispatch({ type: 'RESET_VALUES', values: newValues });

        try {
            await onSave(newValues, true); 
            dispatch({ type: 'RESET_SUCCESS' });
        } catch (e) {
            dispatch({ type: 'RESET_ERROR', message: e.message || 'Reset Failed' });
        }
    };

    const handleVerifyTrigger = () => {
        dispatch({ type: 'SHOW_SAFETY_WARNING' });
    };

    const proceedWithVerification = async () => {
        dispatch({ type: 'START_VERIFY' });
        try {
            const endpoint = `/api/system/outputs/${id}/verify`;
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || 'Verification trigger failed');
            }
            
            dispatch({ type: 'VERIFY_TRIGGERED' });
        } catch (e) {
            dispatch({ type: 'VERIFY_FAILED', message: e.message });
        }
    };

    const handleConfirmSuccess = async () => {
        dispatch({ type: 'START_SAVE' });
        try {
            const res = await onSave(values, false);
            if (res.success) {
                dispatch({ type: 'SAVE_VERIFIED' });
            } else {
                dispatch({ type: 'SAVE_FAILED', message: res.error || 'Save Failed' });
            }
        } catch(e) {
            dispatch({ type: 'SAVE_FAILED', message: e.message });
        }
    };

    if (sensitiveParams.length === 0) return null;

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
                onClose={() => dispatch({ type: 'HIDE_CONFIRM' })}
                onConfirm={handleConfirmSuccess}
                title="Audio Verification"
                message={`Did you hear the test message from ${label}?`}
                confirmText="Yes, Verified"
                cancelText="No, Try Again"
                isDestructive={false}
            />

            <ConfirmModal 
                isOpen={showSafetyWarning}
                onClose={() => dispatch({ type: 'HIDE_SAFETY_WARNING' })}
                onConfirm={proceedWithVerification}
                title="Audio Warning"
                message="This will play audio through your connected output device (e.g., Alexa, speakers). Make sure the volume is at an appropriate level before proceeding."
                confirmText="I Understand, Proceed"
                cancelText="Cancel"
                isDestructive={false}
            />

            <ConfirmModal 
                isOpen={showResetModal}
                onClose={() => dispatch({ type: 'HIDE_RESET_MODAL' })}
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
