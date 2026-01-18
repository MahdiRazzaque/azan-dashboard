import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PasswordInput from '../components/PasswordInput';
import { ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

export default function SetupView() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { refreshAuth } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirm) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 5) { // Basic sanity check
             setError("Password must be at least 5 characters");
             return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Setup failed');

            // On success, refresh auth state (which will detect the cookie and setupRequired: false) and go home
            await refreshAuth();
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 bg-app-card/30 p-8 rounded-2xl border border-app-border backdrop-blur-xl">
                 <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-900/20 mb-4 ring-1 ring-emerald-500/20">
                        <ShieldCheck className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-app-text tracking-tight">Welcome to Azan Dashboard</h1>
                    <p className="text-app-dim text-sm">Please set an administrative password to secure your dashboard.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 text-center animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-app-dim mb-1 ml-1 uppercase tracking-wider">New Password</label>
                            <PasswordInput 
                                value={password} 
                                onChange={setPassword} 
                                showStrength={true} 
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-app-dim mb-1 ml-1 uppercase tracking-wider">Confirm Password</label>
                            <PasswordInput 
                                value={confirm} 
                                onChange={setConfirm}
                                placeholder="Repeat password"
                                showStrength={false}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-app-text rounded-lg font-medium transition-all focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-app-bg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Set Password <ArrowRight className="w-4 h-4" /></>}
                    </button>
                    
                    <p className="text-center text-xs text-app-dim/50">
                        This will generate a secure JWT secret and update your .env file.
                    </p>
                </form>
            </div>
        </div>
    );
}
