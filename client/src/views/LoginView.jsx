import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';

export default function LoginView() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(password);
    if (result.success) {
      const from = location.state?.from?.pathname || '/settings';
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Invalid Password');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-app-bg text-app-text">
      <form onSubmit={handleLogin} className="w-full max-w-sm p-8 bg-app-card rounded-lg shadow-xl border border-app-border">
        <div className="flex flex-col items-center mb-6">
            <div className="p-3 bg-emerald-500/10 rounded-full mb-3">
                <Lock className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-semibold">Admin Access</h2>
        </div>

        {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded text-sm text-center">
                {error}
            </div>
        )}
        
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full p-3 mb-4 bg-app-bg rounded border border-app-border focus:border-emerald-500 focus:outline-none transition-colors text-app-text"
          autoFocus
        />
        
        <button 
            type="submit" 
            className="w-full p-3 bg-emerald-600 hover:bg-emerald-500 rounded font-medium transition-colors text-app-text"
        >
          Unlock Settings
        </button>
      </form>
    </div>
  );
}
