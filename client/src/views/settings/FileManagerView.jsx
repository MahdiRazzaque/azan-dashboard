/* eslint-disable jsdoc/require-jsdoc */
import { useCallback, useMemo, useReducer, useEffect, useRef } from 'react';
import { Play, Trash2, Upload, Server, StopCircle, Volume2, ChevronDown, ChevronRight, Info, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import AudioTestModal from '@/components/common/AudioTestModal';
import ConfirmModal from '@/components/common/ConfirmModal';
import { useSettings } from '@/hooks/useSettings';
import { useAudioFiles } from '@/hooks/useAudioFiles';
import { useOutputStrategies } from '@/hooks/useOutputStrategies';

const EMPTY_ISSUES = [];
const AUDIO_FILE_EXTENSIONS = ['.mp3', '.wav', '.aac', '.ogg', '.opus', '.flac', '.m4a'];
const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

const initialState = {
    uploading: false,
    error: null,
    playingFile: null,
    serverPlaying: null,
    testModalFile: null,
    consentGiven: false,
    collapsedSections: {},
    pendingUpload: null,
    deleteConfirmFile: null,
    expandedFile: null,
    revalidating: null,
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_UPLOADING': return { ...state, uploading: action.value };
        case 'SET_ERROR': return { ...state, error: action.value };
        case 'SET_PLAYING_FILE': return { ...state, playingFile: action.value };
        case 'SET_SERVER_PLAYING': return { ...state, serverPlaying: action.value };
        case 'SET_TEST_MODAL_FILE': return { ...state, testModalFile: action.value };
        case 'SET_CONSENT_GIVEN': return { ...state, consentGiven: action.value };
        case 'TOGGLE_SECTION': return { ...state, collapsedSections: { ...state.collapsedSections, [action.section]: !state.collapsedSections[action.section] } };
        case 'SET_PENDING_UPLOAD': return { ...state, pendingUpload: action.value };
        case 'SET_DELETE_CONFIRM': return { ...state, deleteConfirmFile: action.value };
        case 'SET_EXPANDED_FILE': return { ...state, expandedFile: action.value };
        case 'SET_REVALIDATING': return { ...state, revalidating: action.value };
        default: return state;
    }
}

function isAudioFile(file) {
    return file.type.startsWith('audio/') || AUDIO_FILE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
}

function getFilesByType(files, type) {
    return Array.isArray(files) ? files.filter(file => file.type === type) : [];
}

function groupCacheFiles(cacheFiles) {
    const cacheGroups = PRAYERS.reduce((acc, prayer) => ({ ...acc, [prayer]: [] }), { other: [] });

    cacheFiles.forEach(file => {
        const match = file.name.match(/^tts_([a-z]+)_/);
        if (match && PRAYERS.includes(match[1])) {
            cacheGroups[match[1]].push(file);
        } else {
            cacheGroups.other.push(file);
        }
    });

    return cacheGroups;
}

function createUploadErrorMessage(res) {
    return res.status === 413 ? 'Storage Limit Exceeded' : res.statusText || 'Upload failed';
}

function buildServerPlayPayload(file, outputParams, baseUrl) {
    return {
        prayer: 'test',
        event: file.name,
        params: outputParams,
        source: {
            filePath: null,
            path: file.path,
            url: file.url
        },
        baseUrl,
        filename: file.name,
        type: file.type
    };
}

async function performUploadRequest({ file, dispatch, loadFiles }) {
    const formData = new FormData();
    formData.append('file', file);
    dispatch({ type: 'SET_UPLOADING', value: true });
    dispatch({ type: 'SET_ERROR', value: null });

    try {
        const res = await fetch('/api/settings/upload', {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            let errorMsg = createUploadErrorMessage(res);
            try {
                const data = await res.json();
                errorMsg = data.message || data.error || errorMsg;
            } catch (e) {
                // Not JSON, use fallback message
            }
            throw new Error(errorMsg);
        }

        loadFiles();
    } catch (err) {
        console.error('Upload error:', err);
        if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
            dispatch({ type: 'SET_ERROR', value: 'Upload rejected by server (likely storage limit exceeded)' });
        } else {
            dispatch({ type: 'SET_ERROR', value: err.message });
        }
    } finally {
        dispatch({ type: 'SET_UPLOADING', value: false });
    }
}

function handleUploadSelection({ file, files, dispatch, performUpload, setPendingUpload }) {
    if (!file) return;

    if (!isAudioFile(file)) {
        dispatch({ type: 'SET_ERROR', value: 'Invalid file type. Please upload an audio file.' });
        return;
    }

    const customFiles = getFilesByType(files, 'custom');
    const existingFile = customFiles.find(existing => existing.name === file.name);

    if (existingFile) {
        setPendingUpload(file);
    } else {
        performUpload(file);
    }
}

function confirmOverwriteUpload(pendingUpload, dispatch, performUpload) {
    if (!pendingUpload) return;
    performUpload(pendingUpload);
    dispatch({ type: 'SET_PENDING_UPLOAD', value: null });
}

function cancelOverwriteUpload(dispatch) {
    dispatch({ type: 'SET_PENDING_UPLOAD', value: null });
}

function queueDeleteConfirmation(dispatch, filename) {
    dispatch({ type: 'SET_DELETE_CONFIRM', value: filename });
}

async function revalidateAudioFile({ file, dispatch, setFiles }) {
    dispatch({ type: 'SET_REVALIDATING', value: file.path });
    try {
        const res = await fetch('/api/settings/files/revalidate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, type: file.type })
        });
        if (res.status === 429) throw new Error('Revalidation failed: Too many requests');
        if (!res.ok) throw new Error('Revalidation failed');
        const updatedMetadata = await res.json();

        setFiles(prev => prev.map(current => (
            current.path === file.path ? { ...current, metadata: updatedMetadata } : current
        )));
    } catch (err) {
        dispatch({ type: 'SET_ERROR', value: err.message });
    } finally {
        dispatch({ type: 'SET_REVALIDATING', value: null });
    }
}

async function deleteAudioFile({ filename, dispatch, loadFiles }) {
    dispatch({ type: 'SET_DELETE_CONFIRM', value: null });
    try {
        const res = await fetch('/api/settings/files', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        if (!res.ok) throw new Error('Delete failed');
        loadFiles();
    } catch (err) {
        dispatch({ type: 'SET_ERROR', value: err.message });
    }
}

function toggleBrowserPlayback({ file, audioRef, playingFile, dispatch }) {
    const audio = audioRef.current;
    if (playingFile === file.name) {
        audio.pause();
        dispatch({ type: 'SET_PLAYING_FILE', value: null });
    } else {
        audio.src = file.url;
        audio.play().catch(e => dispatch({ type: 'SET_ERROR', value: `Playback failed: ${e.message}` }));
        dispatch({ type: 'SET_PLAYING_FILE', value: file.name });
        audio.onended = () => dispatch({ type: 'SET_PLAYING_FILE', value: null });
    }
}

async function playFileOnServer({ file, targetId = 'local', config, dispatch }) {
    dispatch({ type: 'SET_SERVER_PLAYING', value: file.name });
    try {
        const endpoint = `/api/system/outputs/${targetId}/test`;
        const outputParams = config.automation?.outputs?.[targetId]?.params || {};
        const payload = buildServerPlayPayload(file, outputParams, config.automation?.baseUrl);

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Test request failed');
        }

        dispatch({ type: 'SET_TEST_MODAL_FILE', value: null });
        setTimeout(() => dispatch({ type: 'SET_SERVER_PLAYING', value: null }), 2000);
    } catch (err) {
        dispatch({ type: 'SET_ERROR', value: err.message || 'Server playback request failed' });
        dispatch({ type: 'SET_SERVER_PLAYING', value: null });
    }
}

function FileManagerHeader({ onUploadChange, uploading }) {
    return (
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold text-app-text mb-2">File Manager</h2>
                <p className="text-app-dim">Manage custom audio files and view generated speech cache.</p>
            </div>

            <div className="relative">
                <input
                    type="file"
                    id="audio-upload"
                    className="hidden"
                    accept="audio/*"
                    onChange={onUploadChange}
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
                    Upload Audio
                </label>
            </div>
        </div>
    );
}

function FileManagerLists(props) {
    return (
        <div className="grid gap-8">
            <FileList
                title="Custom Files"
                type="custom"
                items={props.customFiles}
                expandedFile={props.expandedFile}
                onBrowserPlay={props.onBrowserPlay}
                onDelete={props.onDelete}
                onRevalidate={props.onRevalidate}
                onSelectForTest={props.onSelectForTest}
                onToggleExpanded={props.onToggleExpanded}
                playingFile={props.playingFile}
                revalidating={props.revalidating}
                serverPlaying={props.serverPlaying}
                strategies={props.strategies}
            />

            <TTSCacheSection
                collapsedSections={props.collapsedSections}
                expandedFile={props.expandedFile}
                groupedCacheFiles={props.groupedCacheFiles}
                cacheFiles={props.cacheFiles}
                onBrowserPlay={props.onBrowserPlay}
                onDelete={props.onDelete}
                onRevalidate={props.onRevalidate}
                onSelectForTest={props.onSelectForTest}
                onToggleExpanded={props.onToggleExpanded}
                onToggleSection={props.onToggleSection}
                playingFile={props.playingFile}
                revalidating={props.revalidating}
                serverPlaying={props.serverPlaying}
                strategies={props.strategies}
            />
        </div>
    );
}

function FileManagerModals({ consentGiven, deleteConfirmFile, onCloseDelete, onCloseOverwrite, onCloseTestModal, onConfirmDelete, onConfirmOverwrite, onTest, pendingUpload, setConsentGiven, testModalFile }) {
    return (
        <>
            <AudioTestModal
                isOpen={!!testModalFile}
                onClose={onCloseTestModal}
                file={testModalFile}
                consentGiven={consentGiven}
                setConsentGiven={setConsentGiven}
                onTest={onTest}
            />

            <ConfirmModal
                isOpen={!!pendingUpload}
                onClose={onCloseOverwrite}
                onConfirm={onConfirmOverwrite}
                onCancel={onCloseOverwrite}
                title="Overwrite Existing File?"
                message={`A file named "${pendingUpload?.name}" already exists. Do you want to replace it with the new file?`}
                confirmText="Overwrite"
                cancelText="Cancel"
                isDestructive={true}
            />

            <ConfirmModal
                isOpen={!!deleteConfirmFile}
                onClose={onCloseDelete}
                onConfirm={onConfirmDelete}
                title="Delete File"
                message={`Are you sure you want to delete "${deleteConfirmFile}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                isDestructive={true}
            />
        </>
    );
}

function FileCompatibilityIssues({ issues = EMPTY_ISSUES }) {
    return (
        <ul className="list-disc list-inside">
            {issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
    );
}

function FileRow({ expandedFile, file, onDelete, onRevalidate, onSelectForTest, onToggleExpanded, playingFile, revalidating, serverPlaying, strategies, type, onBrowserPlay }) {
    const isExpanded = expandedFile === file.path;
    const isRevalidating = revalidating === file.path;
    const compatibility = file.metadata?.compatibility || {};

    return (
        <div className="divide-y divide-app-border">
            <div className="p-3 flex items-center justify-between hover:bg-app-card-hover transition-colors group">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-app-bg flex items-center justify-center text-emerald-500">
                        <Volume2 className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-app-text">{file.name}</span>
                        {file.metadata?.duration && (
                            <span className="text-[10px] text-app-dim font-mono">
                                {Math.round(file.metadata.duration)}s • {file.metadata.codec?.toUpperCase()} • {Math.round(file.metadata.bitrate / 1000)}kbps
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onToggleExpanded(isExpanded ? null : file.path)}
                        className={`p-1.5 rounded transition-colors ${isExpanded ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-app-card-hover text-app-dim hover:text-app-text'}`}
                        title="View Compatibility"
                    >
                        <Info className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => onBrowserPlay(file)}
                        className="p-1.5 hover:bg-app-card-hover rounded text-app-dim hover:text-app-text"
                        title="Preview in Browser"
                    >
                        {playingFile === file.name ? <StopCircle className="w-4 h-4 text-emerald-400" /> : <Play className="w-4 h-4" />}
                    </button>

                    <button
                        onClick={() => onSelectForTest(file)}
                        className="p-1.5 hover:bg-app-card-hover rounded text-app-dim hover:text-app-text"
                        title="Test on Speakers"
                    >
                        <Server className={`w-4 h-4 ${serverPlaying === file.name ? 'text-emerald-400 animate-pulse' : ''}`} />
                    </button>

                    {type === 'custom' && !file.metadata?.protected && (
                        <button
                            onClick={() => onDelete(file.name)}
                            className="p-1.5 hover:bg-red-900/20 rounded text-app-dim hover:text-red-400"
                            title="Delete File"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="bg-app-bg/40 p-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold text-app-dim uppercase tracking-wider">Compatibility Analysis</h4>
                        <button
                            onClick={() => onRevalidate(file)}
                            disabled={isRevalidating}
                            className="flex items-center gap-1.5 px-2 py-1 bg-app-card border border-app-border rounded text-[10px] font-bold text-app-text hover:bg-app-card-hover transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3 h-3 ${isRevalidating ? 'animate-spin' : ''}`} />
                            {isRevalidating ? 'Analysing...' : 'Revalidate'}
                        </button>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-app-border bg-app-card/30">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-app-card/50 text-app-dim uppercase tracking-tighter border-b border-app-border">
                                <tr>
                                    <th className="px-3 py-2 font-bold">Strategy</th>
                                    <th className="px-3 py-2 font-bold">Status</th>
                                    <th className="px-3 py-2 font-bold">Issues</th>
                                    <th className="px-3 py-2 font-bold text-right">Last Checked</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-app-border">
                                {[...strategies].sort((a, b) => a.label.localeCompare(b.label)).map(strategy => {
                                    const status = compatibility[strategy.id];
                                    return (
                                        <tr key={strategy.id} className="hover:bg-app-card-hover/20">
                                            <td className="px-3 py-2 font-medium text-app-text">{strategy.label}</td>
                                            <td className="px-3 py-2">
                                                {status?.valid ? (
                                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                                ) : status?.valid === false ? (
                                                    <XCircle className="w-4 h-4 text-red-500" />
                                                ) : (
                                                    <span className="text-app-dim italic">Pending</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-app-dim">
                                                {status?.issues?.length > 0 ? (
                                                    <FileCompatibilityIssues issues={status.issues} />
                                                ) : status?.valid ? (
                                                    <span className="text-emerald-500/70">Compatible</span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right text-app-dim font-mono">
                                                {status?.lastChecked ? new Date(status.lastChecked).toLocaleString() : 'Never'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function FileList({ expandedFile, items, onBrowserPlay, onDelete, onRevalidate, onSelectForTest, onToggleExpanded, playingFile, revalidating, serverPlaying, strategies, title, type }) {
    return (
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
                        <FileRow
                            key={file.path}
                            expandedFile={expandedFile}
                            file={file}
                            onBrowserPlay={onBrowserPlay}
                            onDelete={onDelete}
                            onRevalidate={onRevalidate}
                            onSelectForTest={onSelectForTest}
                            onToggleExpanded={onToggleExpanded}
                            playingFile={playingFile}
                            revalidating={revalidating}
                            serverPlaying={serverPlaying}
                            strategies={strategies}
                            type={type}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function TTSCacheSection({ collapsedSections, expandedFile, groupedCacheFiles, cacheFiles, onBrowserPlay, onDelete, onRevalidate, onSelectForTest, onToggleExpanded, onToggleSection, playingFile, revalidating, serverPlaying, strategies }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-app-border"></div>
                <h3 className="text-app-dim font-bold text-xs uppercase tracking-widest bg-app-bg px-2">TTS Cache by Prayer</h3>
                <div className="h-px flex-1 bg-app-border"></div>
            </div>
            
            {Object.entries(groupedCacheFiles).map(([prayer, items]) => {
                const isCollapsed = collapsedSections[prayer];
                const count = items.length;
                if (count === 0) return null;

                return (
                    <div key={prayer} className="bg-app-card/30 border border-app-border rounded-xl overflow-hidden">
                        <button 
                            onClick={() => onToggleSection(prayer)}
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
                                    <FileRow
                                        key={file.path}
                                        expandedFile={expandedFile}
                                        file={file}
                                        onBrowserPlay={onBrowserPlay}
                                        onDelete={onDelete}
                                        onRevalidate={onRevalidate}
                                        onSelectForTest={onSelectForTest}
                                        onToggleExpanded={onToggleExpanded}
                                        playingFile={playingFile}
                                        revalidating={revalidating}
                                        serverPlaying={serverPlaying}
                                        strategies={strategies}
                                        type="cache"
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {cacheFiles.length === 0 && (
                <div className="p-8 text-center text-app-dim text-sm bg-app-card/20 border border-app-border rounded-xl border-dashed">
                    No cached speech files found
                </div>
            )}
        </div>
    );
}

/**
 * A view component for managing audio files, allowing users to upload, preview,
 * and delete custom audio assets for prayer alerts.
 *
 * @returns {JSX.Element} The rendered file manager view.
 */
export default function FileManagerView() {
    const { config } = useSettings();
    const [state, dispatch] = useReducer(reducer, initialState);
    const { uploading, error, playingFile, serverPlaying, testModalFile, consentGiven, collapsedSections, pendingUpload, deleteConfirmFile, expandedFile, revalidating } = state;
    
    // Audio ref for browser playback
    const audioRef = useRef(new Audio());
    const { files, setFiles } = useAudioFiles();
    const { strategies } = useOutputStrategies();

    const loadFiles = useCallback(async () => {
        try {
            const response = await fetch('/api/system/audio-files');
            if (!response.ok) {
                throw new Error('Failed to load files');
            }

            const data = await response.json();
            setFiles(data.files || []);
            dispatch({ type: 'SET_ERROR', value: null });
        } catch (loadError) {
            console.error('Failed to load files:', loadError);
            dispatch({ type: 'SET_ERROR', value: 'Failed to load files' });
        }
    }, [setFiles]);

    useEffect(() => {
        // Cleanup audio on unmount
        const audio = audioRef.current;
        return () => {
            audio.pause();
            audio.src = '';
        };
    }, []);

    const handleUpload = (e) => {
        handleUploadSelection({
            file: e.target.files[0],
            files,
            dispatch,
            performUpload,
            setPendingUpload: (value) => dispatch({ type: 'SET_PENDING_UPLOAD', value })
        });
        e.target.value = '';
    };

    const performUpload = useCallback((file) => performUploadRequest({ file, dispatch, loadFiles }), [loadFiles]);

    const handleOverwriteConfirm = () => confirmOverwriteUpload(pendingUpload, dispatch, performUpload);

    const handleOverwriteCancel = () => cancelOverwriteUpload(dispatch);

    const handleDelete = async (filename) => {
        queueDeleteConfirmation(dispatch, filename);
    };

    const handleRevalidate = async (file) => {
        return revalidateAudioFile({ file, dispatch, setFiles });
    };

    const confirmDelete = async () => {
        return deleteAudioFile({ filename: deleteConfirmFile, dispatch, loadFiles });
    };

    const handleBrowserPlay = (file) => {
        toggleBrowserPlayback({ file, audioRef, playingFile, dispatch });
    };

    const handleServerPlay = async (file, targetId = 'local') => {
        return playFileOnServer({ file, targetId, config, dispatch });
    };

    const handleToggleSection = useCallback((section) => {
        dispatch({ type: 'TOGGLE_SECTION', section });
    }, []);

    const handleSetExpandedFile = useCallback((value) => {
        dispatch({ type: 'SET_EXPANDED_FILE', value });
    }, []);

    const handleSetTestModalFile = useCallback((value) => {
        dispatch({ type: 'SET_TEST_MODAL_FILE', value });
    }, []);

    const customFiles = getFilesByType(files, 'custom');
    const cacheFiles = getFilesByType(files, 'cache');
    const groupedCacheFiles = useMemo(() => groupCacheFiles(cacheFiles), [cacheFiles]);

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <FileManagerHeader onUploadChange={handleUpload} uploading={uploading} />

            {error && (
                <div className="bg-red-900/20 border border-red-800/50 p-4 rounded-lg text-red-200 text-sm">
                    {error}
                </div>
            )}

            <FileManagerLists
                cacheFiles={cacheFiles}
                collapsedSections={collapsedSections}
                customFiles={customFiles}
                expandedFile={expandedFile}
                groupedCacheFiles={groupedCacheFiles}
                onBrowserPlay={handleBrowserPlay}
                onDelete={handleDelete}
                onRevalidate={handleRevalidate}
                onSelectForTest={handleSetTestModalFile}
                onToggleExpanded={handleSetExpandedFile}
                onToggleSection={handleToggleSection}
                playingFile={playingFile}
                revalidating={revalidating}
                serverPlaying={serverPlaying}
                strategies={strategies}
            />

            <FileManagerModals
                consentGiven={consentGiven}
                deleteConfirmFile={deleteConfirmFile}
                onConfirmDelete={confirmDelete}
                onConfirmOverwrite={handleOverwriteConfirm}
                onCloseDelete={() => dispatch({ type: 'SET_DELETE_CONFIRM', value: null })}
                onCloseOverwrite={handleOverwriteCancel}
                onCloseTestModal={() => dispatch({ type: 'SET_TEST_MODAL_FILE', value: null })}
                onTest={(target) => handleServerPlay(testModalFile, target)}
                pendingUpload={pendingUpload}
                setConsentGiven={(v) => dispatch({ type: 'SET_CONSENT_GIVEN', value: v })}
                testModalFile={testModalFile}
            />
        </div>
    );
}
