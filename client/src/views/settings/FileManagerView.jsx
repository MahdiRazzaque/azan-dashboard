import { useState, useEffect, useRef } from 'react';
import { Play, Trash2, Upload, Server, StopCircle, Volume2, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import AudioTestModal from '@/components/common/AudioTestModal';
import ConfirmModal from '@/components/common/ConfirmModal';
import { useSettings } from '@/hooks/useSettings';

/**
 * A view component for managing audio files, allowing users to upload, preview,
 * and delete custom audio assets for prayer alerts.
 *
 * @returns {JSX.Element} The rendered file manager view.
 */
export default function FileManagerView() {
    const { systemHealth, config } = useSettings();
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [playingFile, setPlayingFile] = useState(null);
    const [serverPlaying, setServerPlaying] = useState(null);
    const [strategies, setStrategies] = useState([]);
    
    // Phase 5: Audio Testing & Consent
    const [testModalFile, setTestModalFile] = useState(null);
    const [consentGiven, setConsentGiven] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState({});
    
    // Overwrite confirmation state
    const [pendingUpload, setPendingUpload] = useState(null);
    const [deleteConfirmFile, setDeleteConfirmFile] = useState(null);
    
    // Audio ref for browser playback
    const audioRef = useRef(new Audio());

    const loadFiles = () => {
        fetch('/api/system/audio-files')
            .then(res => res.json())
            .then(setFiles)
            .catch(err => setError("Failed to load files"));
    };

    useEffect(() => {
        loadFiles();
        
        // Fetch output strategies for testing
        fetch('/api/system/outputs/registry')
            .then(res => res.json())
            .then(setStrategies)
            .catch(err => console.error("Failed to fetch strategies", err));

        // Cleanup audio on unmount
        const audio = audioRef.current;
        return () => {
            audio.pause();
            audio.src = '';
        };
    }, []);

    const handleUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Verify mp3
        if (!file.name.endsWith('.mp3') && file.type !== 'audio/mpeg') {
            setError("Only MP3 files are allowed");
            return;
        }

        // Check if file already exists in custom files
        const customFiles = files.filter(f => f.type === 'custom');
        const existingFile = customFiles.find(f => f.name === file.name);
        
        if (existingFile) {
            // Show confirmation modal
            setPendingUpload(file);
        } else {
            // Upload directly
            performUpload(file);
        }
        
        // Reset the input so the same file can be selected again
        e.target.value = '';
    };

    const performUpload = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        setUploading(true);
        setError(null);

        try {
            const res = await fetch('/api/settings/upload', {
                method: 'POST',
                body: formData // No Content-Type header, let browser set boundary
            });
            
            if (!res.ok) {
                let errorMsg = 'Upload failed';
                try {
                    const data = await res.json();
                    errorMsg = data.message || data.error || errorMsg;
                } catch (e) {
                    // Not JSON, use status text
                    if (res.status === 413) errorMsg = "Storage Limit Exceeded";
                    else errorMsg = res.statusText || errorMsg;
                }
                throw new Error(errorMsg);
            }
            
            loadFiles();
        } catch (err) {
            console.error("Upload error:", err);
            // ERR_CONNECTION_RESET manifests as "Failed to fetch" in TypeError
            if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
                setError("Upload rejected by server (likely storage limit exceeded)");
            } else {
                setError(err.message);
            }
        } finally {
            setUploading(false);
        }
    };

    const handleOverwriteConfirm = () => {
        if (pendingUpload) {
            performUpload(pendingUpload);
            setPendingUpload(null);
        }
    };

    const handleOverwriteCancel = () => {
        setPendingUpload(null);
    };

    const handleDelete = async (filename) => {
        setDeleteConfirmFile(filename);
    };

    const confirmDelete = async () => {
        const filename = deleteConfirmFile;
        setDeleteConfirmFile(null);
        try {
            const res = await fetch('/api/settings/files', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            if (!res.ok) throw new Error('Delete failed');
            loadFiles();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleBrowserPlay = (file) => {
        const audio = audioRef.current;
        if (playingFile === file.name) {
            audio.pause();
            setPlayingFile(null);
        } else {
            audio.src = file.url;
            audio.play().catch(e => setError("Playback failed: " + e.message));
            setPlayingFile(file.name);
            audio.onended = () => setPlayingFile(null);
        }
    };

    const handleServerPlay = async (file, targetId = 'local') => {
        setServerPlaying(file.name);
        try {
            // Polymorphic strategy test endpoint
            const endpoint = `/api/system/outputs/${targetId}/test`;
            
            // Construct payload consistent with automationService expectations
            const payload = {
                prayer: 'test',
                event: file.name,
                source: {
                    filePath: null,
                    path: file.path,
                    url: file.url
                },
                baseUrl: config.automation?.baseUrl,
                // Include filename/type for strategy compatibility (e.g. LocalOutput resolution)
                filename: file.name,
                type: file.type
            };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Test request failed');
            }
            
            setTestModalFile(null); // Close modal on success
            
            // Reset icon after a timeout
            setTimeout(() => setServerPlaying(null), 2000);
        } catch (err) {
            setError(err.message || "Server playback request failed");
            setServerPlaying(null);
        }
    };

    const toggleSection = (section) => {
        setCollapsedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const FileList = ({ title, type, items }) => (
        <div className="bg-app-card/40 border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-app-card/60 border-b border-app-border flex justify-between items-center">
                <h3 className="font-semibold text-app-dim">{title}</h3>
                <span className="text-xs text-app-dim/50">{items.length} files</span>
            </div>
            {items.length === 0 ? (
                <div className="p-8 text-center text-app-dim text-sm">No files found</div>
            ) : (
                <div className="divide-y divide-app-border">
                    {items.map(file => (
                        <div key={file.path} className="p-3 flex items-center justify-between hover:bg-app-card-hover transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-app-bg flex items-center justify-center text-emerald-500">
                                    <Volume2 className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-medium text-app-text">{file.name}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                {/* Browser Play */}
                                <button 
                                    onClick={() => handleBrowserPlay(file)}
                                    className="p-1.5 hover:bg-app-card-hover rounded text-app-dim hover:text-app-text"
                                    title="Preview in Browser"
                                >
                                    {playingFile === file.name ? <StopCircle className="w-4 h-4 text-emerald-400" /> : <Play className="w-4 h-4" />}
                                </button>
                                
                                {/* Server Play - Opens Modal */}
                                <button 
                                    onClick={() => setTestModalFile(file)}
                                    className="p-1.5 hover:bg-app-card-hover rounded text-app-dim hover:text-app-text"
                                    title="Test on Speakers"
                                >
                                    <Server className={`w-4 h-4 ${serverPlaying === file.name ? 'text-emerald-400 animate-pulse' : ''}`} />
                                </button>

                                {/* Delete (Custom only) */}
                                {type === 'custom' && !file.metadata?.protected && (
                                    <button 
                                        onClick={() => handleDelete(file.name)}
                                        className="p-1.5 hover:bg-red-900/20 rounded text-app-dim hover:text-red-400"
                                        title="Delete File"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const customFiles = files.filter(f => f.type === 'custom');
    const cacheFiles = files.filter(f => f.type === 'cache');

    // Grouping logic for TTS
    const prayers = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const groupedCache = prayers.reduce((acc, p) => ({ ...acc, [p]: [] }), { other: [] });
    
    cacheFiles.forEach(file => {
        // Pattern: tts_{prayer}_{event}.mp3
        const match = file.name.match(/^tts_([a-z]+)_/);
        if (match && prayers.includes(match[1])) {
            groupedCache[match[1]].push(file);
        } else {
            groupedCache.other.push(file);
        }
    });

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-app-text mb-2">Audio Manager</h2>
                    <p className="text-app-dim">Manage custom audio files and view generated speech cache.</p>
                </div>
                
                {/* Upload Button */}
                <div className="relative">
                    <input 
                        type="file" 
                        id="audio-upload" 
                        className="hidden" 
                        accept=".mp3,audio/mpeg"
                        onChange={handleUpload}
                        disabled={uploading}
                    />
                    <label 
                        htmlFor="audio-upload"
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium"
                    >
                        {uploading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        Upload MP3
                    </label>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-800/50 p-4 rounded-lg text-red-200 text-sm">
                    {error}
                </div>
            )}

            <div className="grid gap-8">
                <FileList title="Custom Files" type="custom" items={customFiles} />
                
                {/* TTS Grouped List */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-app-border"></div>
                        <h3 className="text-app-dim font-bold text-xs uppercase tracking-widest bg-app-bg px-2">TTS Cache by Prayer</h3>
                        <div className="h-px flex-1 bg-app-border"></div>
                    </div>
                    
                    {Object.entries(groupedCache).map(([prayer, items]) => {
                        const isCollapsed = collapsedSections[prayer];
                        const count = items.length;
                        if (count === 0) return null;

                        return (
                            <div key={prayer} className="bg-app-card/30 border border-app-border rounded-xl overflow-hidden">
                                <button 
                                    onClick={() => toggleSection(prayer)}
                                    className="w-full px-4 py-3 bg-app-card/40 border-b border-app-border flex justify-between items-center hover:bg-app-card-hover transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        {isCollapsed ? <ChevronRight className="w-4 h-4 text-app-dim" /> : <ChevronDown className="w-4 h-4 text-app-dim" />}
                                        <h4 className="font-semibold text-app-text capitalize">{prayer}</h4>
                                    </div>
                                    <span className="text-xs text-app-dim/50">{count} files</span>
                                </button>
                                
                                {!isCollapsed && (
                                    <div className="divide-y divide-app-border">
                                        {items.map(file => (
                                            <div key={file.path} className="p-3 flex items-center justify-between hover:bg-app-card-hover transition-colors group">
                                                <div className="flex items-center gap-3 pl-2">
                                                    <div className="w-8 h-8 rounded bg-app-bg/50 flex items-center justify-center text-emerald-500/70">
                                                        <Volume2 className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-sm font-medium text-app-text/90">{file.name}</span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleBrowserPlay(file)}
                                                        className="p-1.5 hover:bg-app-card-hover rounded text-app-dim hover:text-app-text"
                                                        title="Preview in Browser"
                                                    >
                                                        {playingFile === file.name ? <StopCircle className="w-4 h-4 text-emerald-400" /> : <Play className="w-4 h-4" />}
                                                    </button>
                                                    
                                                    <button 
                                                        onClick={() => setTestModalFile(file)}
                                                        className="p-1.5 hover:bg-app-card-hover rounded text-app-dim hover:text-app-text"
                                                        title="Test on Speakers"
                                                    >
                                                        <Server className={`w-4 h-4 ${serverPlaying === file.name ? 'text-emerald-400 animate-pulse' : ''}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {cacheFiles.length === 0 && (
                        <div className="p-8 text-center text-app-dim text-sm bg-app-card/20 border border-app-border/30 rounded-xl border-dashed">
                            No cached speech files found
                        </div>
                    )}
                </div>
            </div>

            <AudioTestModal 
                isOpen={!!testModalFile}
                onClose={() => setTestModalFile(null)}
                file={testModalFile}
                consentGiven={consentGiven}
                setConsentGiven={setConsentGiven}
                onTest={(target) => handleServerPlay(testModalFile, target)}
            />

            <ConfirmModal
                isOpen={!!pendingUpload}
                onClose={handleOverwriteCancel}
                onConfirm={handleOverwriteConfirm}
                onCancel={handleOverwriteCancel}
                title="Overwrite Existing File?"
                message={`A file named "${pendingUpload?.name}" already exists. Do you want to replace it with the new file?`}
                confirmText="Overwrite"
                cancelText="Cancel"
                isDestructive={true}
            />

            <ConfirmModal
                isOpen={!!deleteConfirmFile}
                onClose={() => setDeleteConfirmFile(null)}
                onConfirm={confirmDelete}
                title="Delete File"
                message={`Are you sure you want to delete "${deleteConfirmFile}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                isDestructive={true}
            />
        </div>
    );
}
