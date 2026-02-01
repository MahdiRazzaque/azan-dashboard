import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { Lock, ShieldCheck, Key } from 'lucide-react';
import PasswordInput from '@/components/common/PasswordInput';
import CredentialStrategyCard from '@/components/settings/CredentialStrategyCard';

/**
 * A view component for managing administrator credentials and integration secrets.
 * It provides functionality for updating the admin password and configuring
 * various integration strategies like Alexa or Voice Monkey.
 *
 * @returns {JSX.Element} The rendered credentials settings view.
 */
export default function CredentialsSettingsView() {
  const { logout } = useAuth();
  const { updateEnvSetting, config, refreshHealth, loading: settingsLoading } = useSettings();
  const [strategies, setStrategies] = useState([]);
  
  // New handlers to support card-level saving
  const handleStrategySave = async (strategyId, secrets, isReset = false) => {
      try {
          // 1. Save Secrets to .env
          for (const [key, value] of Object.entries(secrets)) {
              // Construct the environment variable key from strategy and parameter identifiers (e.g. ALEXA_TOKEN).
              const envKey = `${strategyId.toUpperCase()}_${key.toUpperCase()}`;
              const res = await updateEnvSetting(envKey, value);
              if (!res.success) throw new Error(res.error || `Failed to save ${key}`);
          }

          // 2. Update Verified Status
          // If reset (empty values), set verified to false.
          // If normal save (confirmed via modal), set verified to true.
          const updateRes = await fetch('/api/settings/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  automation: {
                      outputs: {
                          [strategyId]: { verified: !isReset }
                      }
                  }
              })
          });

          if (!updateRes.ok) {
              const errData = await updateRes.json().catch(() => ({}));
              throw new Error(errData.message || errData.error || 'Failed to update verified status');
          }

          // 3. Refresh Health for this strategy
          await refreshHealth(strategyId);
          
          return { success: true };
      } catch (e) {
          return { success: false, error: e.message };
      }
  };

  useEffect(() => {
      fetch('/api/system/outputs/registry')
          .then(res => {
              if (!res.ok) throw new Error('Failed to fetch strategies');
              return res.json();
          })
          .then(data => setStrategies(data.filter(s => s.params.some(p => p.sensitive))))
          .catch(console.error);
  }, []);
  
  // --- Password Change State ---
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState(null);
  
  if (settingsLoading && !config) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-app-dim">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-4"></div>
            <p>Loading security configuration...</p>
        </div>
    );
  }

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
            <p className="text-app-dim mt-1">Manage admin access and integration secrets.</p>
        </div>

        {/* Integration Credentials Section */}
        {strategies.length > 0 && (
            <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-app-border pb-2">
                    <h2 className="text-xl font-semibold text-cyan-400 flex items-center gap-2">
                        <Key className="w-5 h-5" /> Integration Secrets
                    </h2>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg text-sm text-blue-300 space-y-2">
                    <p className="flex items-center gap-2 font-medium">
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                        Secure Secret Management
                    </p>
                    <p className="text-xs leading-relaxed opacity-90">
                        Credentials are encrypted at rest and stored securely. For your protection, once a secret is saved, 
                        it will be masked (<span className="font-mono text-blue-200">********</span>) and cannot be viewed again. 
                        If you need to update a credential, simply enter the new value and verify it.
                    </p>
                    <p className="text-xs italic opacity-75">
                        Note: You must verify credentials by hearing a test sound before they can be committed to the system.
                    </p>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                    {strategies.map(strategy => (
                        <CredentialStrategyCard 
                            key={strategy.id} 
                            strategy={strategy} 
                            initialValues={config?.automation?.outputs?.[strategy.id]?.params || {}}
                            verified={config?.automation?.outputs?.[strategy.id]?.verified}
                            onSave={(values, isReset) => handleStrategySave(strategy.id, values, isReset)}
                        />
                    ))}
                </div>
            </section>
        )}

        {/* Change Password Section */}
        <section className="bg-app-card p-6 rounded-lg border border-app-border shadow-md mt-8">
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