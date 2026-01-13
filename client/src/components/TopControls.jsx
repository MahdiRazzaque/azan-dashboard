import { Volume2, VolumeX, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TopControls = ({ isMuted, toggleMute, blocked }) => {
  const navigate = useNavigate();

  return (
    <div className="absolute top-3 right-3 lg:top-6 lg:right-6 flex gap-3 z-50">
      <button 
        onClick={toggleMute}
        className={`p-2 lg:p-3 rounded-full transition-all duration-300 shadow-lg backdrop-blur-md ${
          blocked ? 'bg-app-danger animate-pulse text-white' : 
          isMuted ? 'bg-app-card hover:bg-app-card/80 text-app-dim' : 'bg-app-card hover:bg-app-card/80 text-app-accent'
        }`}
        title={blocked ? "Audio Blocked - Click to Enable" : isMuted ? "Unmute" : "Mute"}
      >
        {isMuted || blocked ? <VolumeX size={20} className="lg:scale-100 scale-90" /> : <Volume2 size={20} className="lg:scale-100 scale-90" />}
      </button>
      
      <button 
        onClick={() => navigate('/settings')}
        className="p-2 lg:p-3 rounded-full bg-app-card hover:bg-app-card/80 transition-all duration-300 shadow-lg backdrop-blur-md text-app-dim hover:text-white"
        title="Settings"
      >
        <Settings size={20} className="lg:scale-100 scale-90" />
      </button>
    </div>
  );
};

export default TopControls;
