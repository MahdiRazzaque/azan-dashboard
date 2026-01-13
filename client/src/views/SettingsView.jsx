import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SettingsView = ({ logs }) => {
    const navigate = useNavigate();
    const [lastUpdated, setLastUpdated] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetch('/api/prayers')
            .then(res => res.json())
            .then(data => {
                if (data.meta && data.meta.lastFetched) {
                    setLastUpdated(data.meta.lastFetched);
                }
            })
            .catch(err => console.error('Failed to fetch last updated status:', err));
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const res = await fetch('/api/settings/refresh-cache', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                if (data.meta && data.meta.lastFetched) {
                    setLastUpdated(data.meta.lastFetched);
                }
            } else {
                console.error('Refresh failed:', data.error);
            }
        } catch (e) {
            console.error('Refresh network error:', e);
        } finally {
            setRefreshing(false);
        }
    };


    return (
        <div className="h-screen w-screen bg-app-bg p-8 text-white overflow-auto flex flex-col">
            <header className="flex items-center mb-8 shrink-0">
                <button 
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-6 py-3 bg-app-card rounded-xl hover:bg-white/10 transition-colors text-app-accent font-medium shadow-md"
                >
                    <ArrowLeft size={24} />
                    <span>Back to Dashboard</span>
                </button>
                <h1 className="text-4xl font-bold ml-12 tracking-tight">Settings & Logs</h1>
            </header>

            <div className="grid gap-8 max-w-5xl mx-auto w-full flex-1 min-h-0 overflow-y-auto pr-2 pb-10">
                {/* Logs Section */}
                <section className="bg-app-card rounded-3xl p-8 shadow-2xl flex flex-col min-h-[500px]">
                    <h2 className="text-2xl font-semibold mb-6 text-app-dim border-b border-white/10 pb-4">System Event Log</h2>
                    <div className="bg-black/40 rounded-2xl flex-1 overflow-y-scroll p-6 font-mono text-sm space-y-3 custom-scrollbar shadow-inner">
                        {logs.length === 0 && <div className="text-gray-500 italic text-center mt-10">No events recorded yet.</div>}
                        {logs.map((log, index) => (
                            <div key={index} className="flex gap-6 border-b border-white/5 last:border-0 pb-2 mb-2 hover:bg-white/5 p-2 rounded transition-colors">
                                <span className="text-app-dim shrink-0 text-xs w-32 pt-1 font-bold">
                                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '-'}
                                </span>
                                <span className={`break-words flex-1 ${log.type === 'audio' ? 'text-app-accent font-medium' : 'text-gray-300'}`}>
                                    {log.message || (typeof log === 'string' ? log : JSON.stringify(log))}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Data Management Section */}
                <section className="bg-app-card rounded-3xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-semibold mb-6 text-app-dim border-b border-white/10 pb-4">Data Management</h2>
                    <div className="flex items-center justify-between">
                         <div>
                             <p className="text-gray-300 text-lg mb-1">Prayer Times Data</p>
                             <p className="text-sm text-gray-500">
                                 Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Unknown'}
                             </p>
                         </div>
                         <button 
                             onClick={handleRefresh}
                             disabled={refreshing}
                             className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg ${
                                 refreshing 
                                 ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                                 : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white active:scale-95'
                             }`}
                         >
                             <RefreshCw size={20} className={refreshing ? "animate-spin" : ""} />
                             {refreshing ? 'Refreshing...' : 'Force Refresh Data'}
                         </button>
                    </div>
                </section>
                
                {/* Placeholder for actual settings */}
                <section className="bg-app-card rounded-3xl p-8 shadow-2xl opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                    <h2 className="text-2xl font-semibold mb-4 text-app-dim">Device Configuration</h2>
                    <p className="text-gray-400">Advanced settings for coordinates, calculation methods, and delays will be available in Phase 5.</p>
                </section>
            </div>
        </div>
    );
};

export default SettingsView;
