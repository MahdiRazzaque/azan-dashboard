import React, { useState, useMemo } from "react";
import {
  Music,
  Search,
  Play,
  Volume2,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Globe,
  User as UserIcon,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Type,
  Clock,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { useSettings } from "@/hooks/useSettings";
import SearchableSelect from "@/components/common/SearchableSelect";

/**
 * Conditionally joins CSS classes using tailwind-merge and clsx.
 *
 * @param {Array<string|object|undefined|null>} inputs - Class names or conditional class objects.
 * @returns {string} The merged Tailwind CSS class string.
 */
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Locale code to full language name mapping
const LOCALE_NAMES = {
  "af-ZA": "Afrikaans (South Africa)",
  "am-ET": "Amharic (Ethiopia)",
  "ar-AE": "Arabic (UAE)",
  "ar-BH": "Arabic (Bahrain)",
  "ar-DZ": "Arabic (Algeria)",
  "ar-EG": "Arabic (Egypt)",
  "ar-IQ": "Arabic (Iraq)",
  "ar-JO": "Arabic (Jordan)",
  "ar-KW": "Arabic (Kuwait)",
  "ar-LB": "Arabic (Lebanon)",
  "ar-LY": "Arabic (Libya)",
  "ar-MA": "Arabic (Morocco)",
  "ar-OM": "Arabic (Oman)",
  "ar-QA": "Arabic (Qatar)",
  "ar-SA": "Arabic (Saudi Arabia)",
  "ar-SY": "Arabic (Syria)",
  "ar-TN": "Arabic (Tunisia)",
  "ar-YE": "Arabic (Yemen)",
  "az-AZ": "Azerbaijani (Azerbaijan)",
  "bg-BG": "Bulgarian (Bulgaria)",
  "bn-BD": "Bengali (Bangladesh)",
  "bn-IN": "Bengali (India)",
  "bs-BA": "Bosnian (Bosnia)",
  "ca-ES": "Catalan (Spain)",
  "cs-CZ": "Czech (Czech Republic)",
  "cy-GB": "Welsh (UK)",
  "da-DK": "Danish (Denmark)",
  "de-AT": "German (Austria)",
  "de-CH": "German (Switzerland)",
  "de-DE": "German (Germany)",
  "el-GR": "Greek (Greece)",
  "en-AU": "English (Australia)",
  "en-CA": "English (Canada)",
  "en-GB": "English (UK)",
  "en-HK": "English (Hong Kong)",
  "en-IE": "English (Ireland)",
  "en-IN": "English (India)",
  "en-KE": "English (Kenya)",
  "en-NG": "English (Nigeria)",
  "en-NZ": "English (New Zealand)",
  "en-PH": "English (Philippines)",
  "en-SG": "English (Singapore)",
  "en-TZ": "English (Tanzania)",
  "en-US": "English (US)",
  "en-ZA": "English (South Africa)",
  "es-AR": "Spanish (Argentina)",
  "es-BO": "Spanish (Bolivia)",
  "es-CL": "Spanish (Chile)",
  "es-CO": "Spanish (Colombia)",
  "es-CR": "Spanish (Costa Rica)",
  "es-CU": "Spanish (Cuba)",
  "es-DO": "Spanish (Dominican Rep.)",
  "es-EC": "Spanish (Ecuador)",
  "es-ES": "Spanish (Spain)",
  "es-GQ": "Spanish (Equatorial Guinea)",
  "es-GT": "Spanish (Guatemala)",
  "es-HN": "Spanish (Honduras)",
  "es-MX": "Spanish (Mexico)",
  "es-NI": "Spanish (Nicaragua)",
  "es-PA": "Spanish (Panama)",
  "es-PE": "Spanish (Peru)",
  "es-PR": "Spanish (Puerto Rico)",
  "es-PY": "Spanish (Paraguay)",
  "es-SV": "Spanish (El Salvador)",
  "es-US": "Spanish (US)",
  "es-UY": "Spanish (Uruguay)",
  "es-VE": "Spanish (Venezuela)",
  "et-EE": "Estonian (Estonia)",
  "eu-ES": "Basque (Spain)",
  "fa-IR": "Persian (Iran)",
  "fi-FI": "Finnish (Finland)",
  "fil-PH": "Filipino (Philippines)",
  "fr-BE": "French (Belgium)",
  "fr-CA": "French (Canada)",
  "fr-CH": "French (Switzerland)",
  "fr-FR": "French (France)",
  "ga-IE": "Irish (Ireland)",
  "gl-ES": "Galician (Spain)",
  "gu-IN": "Gujarati (India)",
  "he-IL": "Hebrew (Israel)",
  "hi-IN": "Hindi (India)",
  "hr-HR": "Croatian (Croatia)",
  "hu-HU": "Hungarian (Hungary)",
  "hy-AM": "Armenian (Armenia)",
  "id-ID": "Indonesian (Indonesia)",
  "is-IS": "Icelandic (Iceland)",
  "it-IT": "Italian (Italy)",
  "ja-JP": "Japanese (Japan)",
  "jv-ID": "Javanese (Indonesia)",
  "ka-GE": "Georgian (Georgia)",
  "kk-KZ": "Kazakh (Kazakhstan)",
  "km-KH": "Khmer (Cambodia)",
  "kn-IN": "Kannada (India)",
  "ko-KR": "Korean (South Korea)",
  "lo-LA": "Lao (Laos)",
  "lt-LT": "Lithuanian (Lithuania)",
  "lv-LV": "Latvian (Latvia)",
  "mk-MK": "Macedonian (North Macedonia)",
  "ml-IN": "Malayalam (India)",
  "mn-MN": "Mongolian (Mongolia)",
  "mr-IN": "Marathi (India)",
  "ms-MY": "Malay (Malaysia)",
  "mt-MT": "Maltese (Malta)",
  "my-MM": "Burmese (Myanmar)",
  "nb-NO": "Norwegian (Norway)",
  "ne-NP": "Nepali (Nepal)",
  "nl-BE": "Dutch (Belgium)",
  "nl-NL": "Dutch (Netherlands)",
  "pl-PL": "Polish (Poland)",
  "ps-AF": "Pashto (Afghanistan)",
  "pt-BR": "Portuguese (Brazil)",
  "pt-PT": "Portuguese (Portugal)",
  "ro-RO": "Romanian (Romania)",
  "ru-RU": "Russian (Russia)",
  "si-LK": "Sinhala (Sri Lanka)",
  "sk-SK": "Slovak (Slovakia)",
  "sl-SI": "Slovenian (Slovenia)",
  "so-SO": "Somali (Somalia)",
  "sq-AL": "Albanian (Albania)",
  "sr-RS": "Serbian (Serbia)",
  "su-ID": "Sundanese (Indonesia)",
  "sv-SE": "Swedish (Sweden)",
  "sw-KE": "Swahili (Kenya)",
  "sw-TZ": "Swahili (Tanzania)",
  "ta-IN": "Tamil (India)",
  "ta-LK": "Tamil (Sri Lanka)",
  "ta-MY": "Tamil (Malaysia)",
  "ta-SG": "Tamil (Singapore)",
  "te-IN": "Telugu (India)",
  "th-TH": "Thai (Thailand)",
  "tr-TR": "Turkish (Turkey)",
  "uk-UA": "Ukrainian (Ukraine)",
  "ur-IN": "Urdu (India)",
  "ur-PK": "Urdu (Pakistan)",
  "uz-UZ": "Uzbek (Uzbekistan)",
  "vi-VN": "Vietnamese (Vietnam)",
  "wuu-CN": "Wu Chinese (China)",
  "yue-CN": "Cantonese (China)",
  "zh-CN": "Chinese (Mandarin, China)",
  "zh-HK": "Chinese (Hong Kong)",
  "zh-TW": "Chinese (Taiwan)",
  "zu-ZA": "Zulu (South Africa)",
};

const DEFAULT_PREVIEW_TEXT = "{minutes} minutes until {prayerArabic}";
const DEFAULT_MINUTES = 15;

const cleanVoiceName = (name) => {
  if (!name) return "";
  let cleaned = name
    .replace(/Microsoft\s+/gi, "")
    .replace(/\s+Online/gi, "")
    .replace(/\s*\(Natural\)/gi, "")
    .replace(/\s+-\s+.*$/, "")
    .trim();
  return cleaned || name;
};

const getLanguage = (locale) => {
  const fullName = LOCALE_NAMES[locale];
  if (fullName) return fullName.split(" (")[0];
  return locale.split("-")[0].toUpperCase();
};

const getRegion = (locale) => {
  const fullName = LOCALE_NAMES[locale];
  if (fullName) {
    const match = fullName.match(/\(([^)]+)\)/);
    return match ? match[1] : locale.split("-")[1];
  }
  return locale.split("-")[1] || "";
};

/**
 * Inline Voice Library component for embedding in settings views.
 *
 * @param {object} props - The component props.
 * @param {string} [props.searchQuery] - Lifted search query state.
 * @param {Function} [props.onSearchChange] - Callback for search query changes.
 * @param {string} [props.selectedLocale] - Lifted locale filter state.
 * @param {Function} [props.onLocaleChange] - Callback for locale filter changes.
 * @param {string} [props.selectedGender] - Lifted gender filter state.
 * @param {Function} [props.onGenderChange] - Callback for gender filter changes.
 * @returns {JSX.Element} The rendered VoiceLibrary component.
 */
const VoiceLibrary = ({
  searchQuery,
  onSearchChange,
  selectedLocale,
  onLocaleChange,
  selectedGender,
  onGenderChange,
}) => {
  const {
    config,
    draftConfig,
    updateSetting,
    voices,
    voicesLoading: loading,
    voicesError: error,
  } = useSettings();

  // Internal state for when props are not provided (backwards compatibility)
  const [internalSearch, setInternalSearch] = useState("");
  const [internalFilters, setInternalFilters] = useState({
    gender: "All",
    locale: "All",
  });

  // Use props if provided, otherwise fallback to internal state
  const search = searchQuery !== undefined ? searchQuery : internalSearch;
  const setSearch = onSearchChange || setInternalSearch;

  const gender =
    selectedGender !== undefined ? selectedGender : internalFilters.gender;
  const setGender =
    onGenderChange ||
    ((val) => setInternalFilters((f) => ({ ...f, gender: val })));

  const locale =
    selectedLocale !== undefined ? selectedLocale : internalFilters.locale;
  const setLocale =
    onLocaleChange ||
    ((val) => setInternalFilters((f) => ({ ...f, locale: val })));

  const [previewPrayer, setPreviewPrayer] = useState("Maghrib");
  const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
  const [previewMinutes, setPreviewMinutes] = useState(DEFAULT_MINUTES);
  const [previewing, setPreviewing] = useState(null);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(true);

  const ARABIC_NAMES = {
    Fajr: "فجر",
    Sunrise: "شُروق",
    Dhuhr: "ظُهْر",
    Asr: "عصر",
    Maghrib: "مغرب",
    Isha: "عشاء",
  };

  const filteredVoices = useMemo(() => {
    return voices.filter((v) => {
      const matchSearch =
        v.Name.toLowerCase().includes(search.toLowerCase()) ||
        v.ShortName.toLowerCase().includes(search.toLowerCase());
      const matchGender = gender === "All" || v.Gender === gender;
      const matchLocale = locale === "All" || v.Locale === locale;
      return matchSearch && matchGender && matchLocale;
    });
  }, [voices, search, gender, locale]);

  const locales = useMemo(() => {
    const set = new Set(voices.map((v) => v.Locale));
    return ["All", ...Array.from(set).sort()];
  }, [voices]);

  const handlePlayPreview = async (voiceShortName) => {
    setPreviewing(voiceShortName);
    try {
      const response = await fetch("/api/system/preview-tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template: previewText,
          prayerKey: previewPrayer,
          offsetMinutes: previewMinutes,
          voice: voiceShortName,
        }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      const audio = new Audio(data.url);
      audio.onended = () => setPreviewing(null);
      audio.onerror = () => {
        console.error("[VoiceLibrary] Audio playback failed");
        setPreviewing(null);
      };
      await audio.play();
    } catch (err) {
      console.error("[VoiceLibrary] Preview failed:", err);
      setPreviewing(null);
    }
  };

  const handleSetDefault = (voiceShortName) => {
    updateSetting("automation.defaultVoice", voiceShortName);
  };

  const handleResetPreviewText = () => {
    setPreviewText(DEFAULT_PREVIEW_TEXT);
    setPreviewMinutes(DEFAULT_MINUTES);
  };

  const hasArabic =
    previewText.includes("{prayerArabic}") ||
    /[\u0600-\u06FF]/.test(previewText);

  // Saved state (what's currently in the backend)
  const savedDefault = config.automation?.defaultVoice;
  // Pending state (what's queued for save in the draft)
  const pendingDefault = draftConfig?.automation?.defaultVoice;
  // Check if we should show the Arabic warning
  const activeVoiceShortName = pendingDefault || savedDefault;
  const activeVoice = voices.find((v) => v.ShortName === activeVoiceShortName);
  const isNonArabicVoice = activeVoice && !activeVoice.Locale.startsWith("ar-");
  const showArabicWarning = hasArabic && isNonArabicVoice;

  // Check if there's an unsaved change
  const hasPendingChange = pendingDefault && pendingDefault !== savedDefault;

  return (
    <div className="space-y-4">
      {/* 1. Preview Context Area (Collapsible) */}
      <div className="bg-app-bg/30 rounded-lg border border-app-border overflow-hidden transition-all duration-300">
        <button
          onClick={() => setIsPreviewCollapsed(!isPreviewCollapsed)}
          className="w-full flex items-center justify-between px-4 py-3 bg-app-card/50 hover:bg-app-card-hover/50 transition-colors group"
        >
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold text-app-text">
              Quick Preview Controls
            </span>
            {!isPreviewCollapsed && (
              <span className="text-[10px] text-app-dim font-medium ml-2 bg-app-card px-1.5 py-0.5 rounded border border-app-border">
                Configure Test Output
              </span>
            )}
          </div>
          {isPreviewCollapsed ? (
            <ChevronDown className="w-4 h-4 text-app-dim group-hover:text-app-text" />
          ) : (
            <ChevronUp className="w-4 h-4 text-app-dim group-hover:text-app-text" />
          )}
        </button>

        <div
          className={cn(
            "px-4 transition-all duration-300",
            isPreviewCollapsed
              ? "max-h-0 py-0 opacity-0 overflow-hidden"
              : "max-h-[500px] py-4 opacity-100",
          )}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Text Input & Reset */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-app-dim uppercase tracking-widest flex items-center gap-1.5">
                    <Type className="w-3 h-3" /> Preview Template
                  </label>
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      previewText.length > 40
                        ? "text-amber-500"
                        : "text-app-dim",
                    )}
                  >
                    {previewText.length}/50
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={50}
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  className="w-full bg-app-card border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-emerald-500 transition-all font-medium"
                  placeholder="{minutes} minutes until {prayerArabic}"
                />
                <p className="text-[10px] text-app-dim mt-1.5 ml-1">
                  Use{" "}
                  <code className="bg-app-card border border-app-border px-1 py-0.5 rounded text-[10px] text-emerald-500 font-mono">
                    {"{prayerEnglish}"}
                  </code>{" "}
                  or{" "}
                  <code className="bg-app-card border border-app-border px-1 py-0.5 rounded text-[10px] text-emerald-500 font-mono">
                    {"{prayerArabic}"}
                  </code>{" "}
                  to insert the prayer name.
                </p>
              </div>
              <button
                onClick={handleResetPreviewText}
                className="flex items-center gap-2 px-3 py-1.5 bg-app-card border border-app-border rounded-lg text-xs font-bold text-app-dim hover:text-app-text hover:border-app-dim transition-all group/reset"
              >
                <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-[-180deg] transition-transform duration-500" />
                Reset Template
              </button>
            </div>

            {/* Right Column: Prayer & Minutes */}
            <div className="space-y-6">
              {/* Prayer Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-app-dim uppercase tracking-widest flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Select Event
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(ARABIC_NAMES).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPreviewPrayer(p)}
                      className={cn(
                        "px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all uppercase tracking-tight",
                        previewPrayer === p
                          ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                          : "bg-app-card border-app-border text-app-dim hover:text-app-text",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minutes Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-app-dim uppercase tracking-widest flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Minutes Calculation
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={previewMinutes}
                    onChange={(e) =>
                      setPreviewMinutes(
                        Math.max(
                          0,
                          Math.min(60, parseInt(e.target.value) || 0),
                        ),
                      )
                    }
                    className="w-24 bg-app-card border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-emerald-500 transition-all font-mono"
                  />
                  <span className="text-[10px] text-app-dim italic font-medium">
                    Replaces {"{minutes}"} in template with spoken word
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filters & Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-dim" />
          <input
            type="text"
            placeholder="Search voices..."
            className="w-full bg-app-card border border-app-border rounded-lg pl-10 pr-4 py-2 text-sm text-app-text focus:outline-none focus:border-emerald-500 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="w-[160px] flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-app-dim flex-shrink-0" />
          <SearchableSelect
            value={gender}
            onChange={setGender}
            options={[
              { value: "All", label: "All Genders" },
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
            ]}
          />
        </div>

        <div className="w-[200px] flex items-center gap-2">
          <Globe className="w-4 h-4 text-app-dim flex-shrink-0" />
          <SearchableSelect
            value={locale}
            onChange={setLocale}
            options={locales.map((l) => ({
              value: l,
              label: l === "All" ? "All Languages" : LOCALE_NAMES[l] || l,
            }))}
          />
        </div>
      </div>

      {/* 3. Voice Table (Dynamic Height) */}
      <div className="rounded-lg border border-app-border overflow-hidden">
        {loading ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3 text-app-dim text-sm bg-app-bg/20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            Loading voices...
          </div>
        ) : error ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3 text-red-400 p-6 text-center bg-app-bg/20">
            <AlertTriangle className="w-8 h-8" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div
            className="overflow-auto scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent"
            style={{ height: isPreviewCollapsed ? "340px" : "220px" }} // Approx 5 rows vs 3 rows (cell height ~60px + header)
          >
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-app-card z-10">
                <tr className="text-left text-[10px] font-bold text-app-dim uppercase tracking-widest border-b border-app-border">
                  <th className="px-4 py-3">Preview</th>
                  <th className="px-4 py-3">Voice</th>
                  <th className="px-4 py-3 hidden md:table-cell">Language</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Region</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Gender</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/50 bg-app-bg/10">
                {filteredVoices.map((voice) => (
                  <tr
                    key={voice.ShortName}
                    className="hover:bg-app-card-hover/30 group transition-colors h-[64px]"
                  >
                    <td className="px-4 py-2">
                      <button
                        disabled={previewing !== null}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayPreview(voice.ShortName);
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          previewing === voice.ShortName
                            ? "bg-emerald-500 text-white animate-pulse shadow-lg shadow-emerald-500/30"
                            : "bg-app-card text-app-dim group-hover:text-emerald-500 border border-transparent group-hover:border-emerald-500/20 shadow-sm",
                        )}
                      >
                        {previewing === voice.ShortName ? (
                          <Volume2 className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-app-text group-hover:text-emerald-500 transition-colors">
                          {cleanVoiceName(
                            voice.FriendlyName ||
                              voice.ShortName.split("-").pop(),
                          )}
                        </span>
                        <span className="text-[10px] font-mono text-app-dim tabular-nums">
                          {voice.ShortName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      <span className="text-xs text-app-text font-medium">
                        {getLanguage(voice.Locale)}
                      </span>
                    </td>
                    <td className="px-4 py-2 hidden lg:table-cell">
                      <span className="text-xs text-app-dim">
                        {getRegion(voice.Locale)}
                      </span>
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-tight shadow-sm",
                          voice.Gender === "Male"
                            ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                            : "bg-pink-500/10 text-pink-500 border border-pink-500/20",
                        )}
                      >
                        {voice.Gender}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {pendingDefault === voice.ShortName &&
                      pendingDefault !== savedDefault ? (
                        // Pending selection (unsaved)
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-500/10 border border-orange-500/50 text-orange-500 rounded-lg text-[10px] font-bold uppercase tracking-wider animate-pulse">
                          <CheckCircle className="w-3.5 h-3.5" /> Pending Save
                        </span>
                      ) : savedDefault === voice.ShortName &&
                        !hasPendingChange ? (
                        // Currently saved default
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle className="w-3.5 h-3.5" /> Default
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetDefault(voice.ShortName)}
                          className="px-3 py-1 bg-app-card hover:bg-emerald-600 border border-app-border hover:border-emerald-500 text-app-text hover:text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                        >
                          Set Default
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Warnings and Contextual Info */}
      {showArabicWarning && (
        <div className="flex items-center gap-2 text-[10px] text-amber-500 font-medium bg-amber-500/5 p-3 rounded-lg border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p>
            <span className="font-bold uppercase tracking-tight mr-1">
              Pronunciation Warning:
            </span>
            The selected voice (
            {activeVoice?.FriendlyName || activeVoiceShortName}) is not natively
            Arabic. It may struggle with the Arabic text or variables in your
            preview template.
          </p>
        </div>
      )}

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] text-app-dim px-1 font-bold uppercase tracking-widest">
        <span>{filteredVoices.length} voices available</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-4">
          {hasPendingChange && (
            <div className="flex items-center gap-2 text-orange-500">
              <span>Pending:</span>
              <code className="bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/30">
                {pendingDefault}
              </code>
            </div>
          )}
          {savedDefault && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-600">Saved:</span>
              <code className="bg-app-card px-1.5 py-0.5 rounded border border-app-border text-emerald-500">
                {savedDefault}
              </code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceLibrary;
