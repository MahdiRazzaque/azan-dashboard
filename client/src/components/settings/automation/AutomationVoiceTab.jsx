import { Music } from "lucide-react";
import VoiceLibrary from "@/components/settings/VoiceLibrary";

/**
 * AutomationVoiceTab component wraps the VoiceLibrary with lifted state.
 *
 * @param {object} props - The component props.
 * @param {string} props.voiceSearch - Lifted search query.
 * @param {Function} props.onVoiceSearchChange - Callback for search query change.
 * @param {string} props.voiceLocale - Lifted locale filter.
 * @param {Function} props.onVoiceLocaleChange - Callback for locale filter change.
 * @param {string} props.voiceGender - Lifted gender filter.
 * @param {Function} props.onVoiceGenderChange - Callback for gender filter change.
 * @returns {JSX.Element} The rendered voice library tab.
 */
export default function AutomationVoiceTab({
  voiceSearch,
  onVoiceSearchChange,
  voiceLocale,
  onVoiceLocaleChange,
  voiceGender,
  onVoiceGenderChange,
}) {
  return (
    <section className="bg-app-card p-6 rounded-lg border border-app-border shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-emerald-400 flex items-center gap-2 border-b border-app-border pb-2">
        <Music className="w-5 h-5" />
        Voice Library
      </h2>
      <p className="text-sm text-app-dim mb-6">
        Browse and preview over 100 high-quality TTS voices. Set a global
        default voice for all triggers, or configure individual triggers to use
        specific voices.
      </p>
      <VoiceLibrary
        searchQuery={voiceSearch}
        onSearchChange={onVoiceSearchChange}
        selectedLocale={voiceLocale}
        onLocaleChange={onVoiceLocaleChange}
        selectedGender={voiceGender}
        onGenderChange={onVoiceGenderChange}
      />
    </section>
  );
}
