import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { Save, Lock, ShieldCheck, Zap, AlertTriangle, CheckCircle, Smartphone, Key, Trash2, Undo2 } from 'lucide-react';
import PasswordInput from '@/components/common/PasswordInput';
import ConfirmModal from '@/components/common/ConfirmModal';

/**
 * A view component for managing security credentials and third-party integrations,
 * such as dashboard passwords and VoiceMonkey API settings.
 *
 * @returns {JSX.Element} The rendered credentials settings view.
 */
export default function CredentialsSettingsView() {
  const { logout } = useAuth();
  const { config, refresh, refreshHealth } = useSettings();
  
  // --- VoiceMonkey State ---
  const [vmToken, setVmToken] = useState('');
  const [vmDevice, setVmDevice] = useState('');
  const [initialToken, setInitialToken] = useState('');
  const [initialDevice, setInitialDevice] = useState('');
  
  const [vmStatus, setVmStatus] = useState('idle'); // idle, testing, verifying, saving, success, error
  const [vmMessage, setVmMessage] = useState(null);
  const [showVmConfirm, setShowVmConfirm] = useState(false);

  // Initialize from config
  useEffect(() => {
      if (!config?.automation?.voiceMonkey) return;

      const t = config.automation.voiceMonkey.token || '';
      const d = config.automation.voiceMonkey.device || '';
      
      Promise.resolve().then(() => {
          setVmToken(prev => (t !== prev ? t : prev));
          setVmDevice(prev => (d !== prev ? d : prev));
          setInitialToken(prev => (t !== prev ? t : prev));
          setInitialDevice(prev => (d !== prev ? d : prev));
          
          if (t && d) {
              setVmStatus(prev => (prev === 'idle' ? 'success' : prev));
          }
      });
  }, [config]);

  const isDirty = vmToken !== initialToken || vmDevice !== initialDevice;
  const hasSavedCredentials = !!initialToken && !!initialDevice;

  const handleDiscard = () => {
      setVmToken(initialToken);
      setVmDevice(initialDevice);
      setVmStatus(hasSavedCredentials ? 'success' : 'idle');
      setVmMessage(null);
  };

  const handleReset = async () => {
      if (!confirm('Are you sure you want to remove your VoiceMonkey credentials? This will disable announcements.')) return;
      
      try {
          const res = await fetch('/api/settings/credentials/voicemonkey', { method: 'DELETE' });
          if (res.ok) {
              setVmToken('');
              setVmDevice('');
              setInitialToken('');
              setInitialDevice('');
              setVmStatus('idle');
              setVmMessage(null);
              await refresh();
              await refreshHealth('voiceMonkey'); // Force health update
          } else {
              setVmMessage('Failed to reset credentials.');
          }
      } catch (e) {
          setVmMessage('Failed to reset credentials.');
      }
  };

  const handleTestVoiceMonkey = async () => {
      setVmStatus('testing');
      setVmMessage(null);
  
      if (!vmToken || !vmDevice) {
          setVmStatus('error');
          setVmMessage('Token and Device ID are required.');
          return;
      }
  
      try {
          const res = await fetch('/api/system/test-voicemonkey', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: vmToken, device: vmDevice })
          });
          const data = await res.json();
          
          if (res.ok && data.success) {
              setVmStatus('verifying');
              setShowVmConfirm(true); 
          } else {
              setVmStatus('error');
              setVmMessage(data.message || data.error.includes('400') ? "Invalid credentials" : 'Test failed. Please check credentials.');
          }
      } catch (e) {
          setVmStatus('error');
          setVmMessage(e.message);
      }
  };
  
  const handleSaveVoiceMonkey = async () => {
      setShowVmConfirm(false);
      setVmStatus('saving');
      
      try {
          const res = await fetch('/api/settings/credentials/voicemonkey', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: vmToken, device: vmDevice })
          });
          
          const data = await res.json();
          if (res.ok) {
              setVmStatus('success');
              // Update initial state to match new saved state
              setInitialToken(vmToken);
              setInitialDevice(vmDevice);
              setVmMessage(null); // Clear message as button says "Verified & Saved"
              await refresh();
              await refreshHealth('voiceMonkey'); // Force health update
          } else {
              setVmStatus('error');
              setVmMessage(data.message || data.error || 'Failed to save credentials.');
          }
      } catch (e) {
          setVmStatus('error');
          setVmMessage(e.message);
      }
  };
  
  
  // --- Password Change State ---
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState(null);
  
  const handleChangePassword = async () => {
      setPassMsg(null);
      if (!newPassword) return;
      if (newPassword !== confirmPassword) {
          setPassMsg({ type: 'error', text: 'Passwords do not match' });
          return;
      }
      
      try {
          const res = await fetch('/api/auth/change-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: newPassword })
          });
          const data = await res.json();
          if (res.ok) {
              setPassMsg({ type: 'success', text: 'Password updated. Logging out...' });
              setNewPassword('');
              setConfirmPassword('');
              setTimeout(() => logout(), 1500);
          } else {
              setPassMsg({ type: 'error', text: data.message || data.error || 'Failed' });
          }
      } catch (e) {
          setPassMsg({ type: 'error', text: e.message });
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <div>
            <h1 className="text-3xl font-bold text-app-text">Credentials & Security</h1>
            <p className="text-app-dim mt-1">Manage external API keys and system access.</p>
        </div>

        {/* VoiceMonkey Section */}
        <section className="bg-app-card p-6 rounded-lg border border-app-border shadow-md">
            <div className="flex items-center justify-between mb-6 border-b border-app-border pb-2">
                <h2 className="text-xl font-semibold text-cyan-400 flex items-center gap-2">
                    <Zap className="w-5 h-5" /> VoiceMonkey Integration
                </h2>
                <div className="flex items-center gap-2">
                    {isDirty && hasSavedCredentials && (
                        <button
                            onClick={handleDiscard}
                            title="Discard Changes"
                            className="p-2 text-app-dim hover:text-app-text hover:bg-app-card-hover rounded-full transition-colors"
                        >
                            <Undo2 className="w-5 h-5" />
                        </button>
                    )}
                    {hasSavedCredentials && (
                        <button
                            onClick={handleReset}
                            title="Reset / Delete Credentials"
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
            
            <p className="text-sm text-app-dim mb-6">
                Configure your VoiceMonkey credentials to enable Smart Home announcements.
                These keys are stored securely in the system environment variables.
            </p>

            <div className="max-w-xl space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-app-dim flex items-center gap-2">
                            <Key className="w-4 h-4 text-app-dim/50" /> API Token
                        </label>
                        <PasswordInput 
                            value={vmToken}
                            onChange={setVmToken}
                            placeholder="VoiceMonkey API Token"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-app-dim flex items-center gap-2">
                            <Smartphone className="w-4 h-4 text-app-dim/50" /> Device ID
                        </label>
                         <input 
                            type="text"
                            value={vmDevice}
                            onChange={(e) => setVmDevice(e.target.value)}
                            className="w-full bg-app-bg border border-app-border rounded-md px-3 py-2 text-app-text focus:outline-none focus:border-emerald-500 transition-colors"
                            placeholder="e.g. alexa-announcer"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                     <div className="flex items-center gap-3">
                         <button
                            onClick={handleTestVoiceMonkey}
                            disabled={!isDirty || vmStatus === 'testing' || vmStatus === 'saving' || !vmToken || !vmDevice}
                            className={`
                                flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all
                                ${(!isDirty && vmStatus === 'success') 
                                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/50 cursor-default' 
                                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20'}
                                disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                         >
                            {vmStatus === 'testing' ? (
                                <>Testing...</>
                            ) : (!isDirty && vmStatus === 'success') ? (
                                <><CheckCircle className="w-4 h-4" /> Verified & Saved</>
                            ) : (
                                <><Zap className="w-4 h-4" /> Test & Save Credentials</>
                            )}
                         </button>
                     </div>
                     
                     {vmStatus === 'error' && (
                         <span className="text-sm font-medium text-red-400 flex items-center gap-1">
                             <AlertTriangle className="w-4 h-4" /> {vmMessage}
                         </span>
                     )}
                     {vmStatus === 'success' && vmMessage && (
                         <span className="text-sm font-medium text-emerald-400">
                             {vmMessage}
                         </span>
                     )}
                </div>
            </div>
            
            <ConfirmModal 
                isOpen={showVmConfirm}
                onClose={() => { setShowVmConfirm(false); setVmStatus('idle'); }}
                onConfirm={handleSaveVoiceMonkey}
                title="Did you hear it?"
                message="We sent a test announcement to your device. Did you hear the 'Test' message play?"
                confirmText="Yes, I heard it"
                cancelText="No, try again"
                isDestructive={false}
            />
        </section>


        {/* Change Password Section */}
        <section className="bg-app-card p-6 rounded-lg border border-app-border shadow-md">
            <h2 className="text-xl font-semibold mb-6 text-emerald-400 border-b border-app-border pb-2 flex items-center gap-2">
                <Lock className="w-5 h-5" /> Change Admin Password
            </h2>
            <div className="max-w-md space-y-4">
                 <div className="space-y-2">
                    <label className="block text-sm font-medium text-app-dim">New Password</label>
                    <PasswordInput 
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="New Password"
                        showStrength={true}
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="block text-sm font-medium text-app-dim">Confirm New Password</label>
                    <PasswordInput 
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        placeholder="Confirm New Password"
                        showStrength={false}
                    />
                 </div>
                 
                 <div className="flex items-center gap-4 mt-6">
                     <button
                        onClick={handleChangePassword}
                        disabled={!newPassword || !confirmPassword || newPassword.length < 5}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                     >
                        <ShieldCheck className="w-4 h-4" />
                        Update Password
                     </button>
                     {passMsg && (
                         <span className={`text-sm font-medium ${passMsg.type === 'success' ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`}>
                             {passMsg.text}
                         </span>
                     )}
                 </div>
            </div>
        </section>
    </div>
  );
}
