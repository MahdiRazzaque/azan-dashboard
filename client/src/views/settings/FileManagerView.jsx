import { useState, useEffect, useRef } from 'react';
import { Play, Trash2, Upload, Server, StopCircle, Volume2 } from 'lucide-react';

export default function FileManagerView() {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [playingFile, setPlayingFile] = useState(null);
    const [serverPlaying, setServerPlaying] = useState(null);
    
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
        
        // Cleanup audio on unmount
        const audio = audioRef.current;
        return () => {
            audio.pause();
            audio.src = '';
        };
    }, []);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Verify mp3
        if (!file.name.endsWith('.mp3') && file.type !== 'audio/mpeg') {
            setError("Only MP3 files are allowed");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        setUploading(true);
        setError(null);

        try {
            const res = await fetch('/api/settings/upload', {
                method: 'POST',
                body: formData // No Content-Type header, let browser set boundary
            });
            if (!res.ok) throw new Error('Upload failed');
            loadFiles();
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (filename) => {
        if (!confirm(`Delete ${filename}?`)) return;
        
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

    const handleServerPlay = async (file) => {
        setServerPlaying(file.name);
        try {
            await fetch('/api/system/test-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, type: file.type })
            });
            // Reset icon after a timeout since we don't get 'ended' event from server
            setTimeout(() => setServerPlaying(null), 2000);
        } catch (err) {
            setError("Server playback request failed");
            setServerPlaying(null);
        }
    };

    const FileList = ({ title, type, items }) => (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-zinc-900/60 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="font-semibold text-zinc-300">{title}</h3>
                <span className="text-xs text-zinc-500">{items.length} files</span>
            </div>
            {items.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-sm">No files found</div>
            ) : (
                <div className="divide-y divide-zinc-800/50">
                    {items.map(file => (
                        <div key={file.path} className="p-3 flex items-center justify-between hover:bg-zinc-800/30 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-emerald-500">
                                    <Volume2 className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-medium text-zinc-200">{file.name}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                {/* Browser Play */}
                                <button 
                                    onClick={() => handleBrowserPlay(file)}
                                    className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
                                    title="Preview in Browser"
                                >
                                    {playingFile === file.name ? <StopCircle className="w-4 h-4 text-emerald-400" /> : <Play className="w-4 h-4" />}
                                </button>
                                
                                {/* Server Play */}
                                <button 
                                    onClick={() => handleServerPlay(file)}
                                    className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
                                    title="Test on Server Speaker"
                                >
                                    <Server className={`w-4 h-4 ${serverPlaying === file.name ? 'text-emerald-400 animate-pulse' : ''}`} />
                                </button>

                                {/* Delete (Custom only) */}
                                {type === 'custom' && (
                                    <button 
                                        onClick={() => handleDelete(file.name)}
                                        className="p-1.5 hover:bg-red-900/20 rounded text-zinc-500 hover:text-red-400"
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

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Audio Manager</h2>
                    <p className="text-zinc-400">Manage custom audio files and view generated speech cache.</p>
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
                <FileList title="TTS Cache" type="cache" items={cacheFiles} />
            </div>
        </div>
    );
}
