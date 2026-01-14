import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Save, Lock, ShieldCheck } from 'lucide-react';
import PasswordInput from '../../components/PasswordInput';

export default function AccountSettingsView() {
  const { logout } = useAuth();
  
  // Password Change State
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
              setPassMsg({ type: 'error', text: data.error || 'Failed' });
          }
      } catch (e) {
          setPassMsg({ type: 'error', text: e.message });
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <div>
            <h1 className="text-3xl font-bold text-white">Account Settings</h1>
            <p className="text-zinc-400 mt-1">Manage your administrator account security.</p>
        </div>

        {/* Change Password Section */}
        <section className="bg-zinc-900 p-6 rounded-lg border border-zinc-800 shadow-md">
            <h2 className="text-xl font-semibold mb-6 text-emerald-400 border-b border-zinc-800 pb-2 flex items-center gap-2">
                <Lock className="w-5 h-5" /> Change Password
            </h2>
            <div className="max-w-md space-y-4">
                 <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-300">New Password</label>
                    <PasswordInput 
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="New Password"
                        showStrength={true}
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-300">Confirm New Password</label>
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
