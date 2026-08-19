# COMPONENTS KNOWLEDGE BASE

## STRUCTURE

```
components/
├── dashboard/
│   ├── PrayerCard.jsx       # Individual prayer time display
│   └── FocusCard.jsx        # Next prayer countdown with progress
├── settings/
│   ├── TriggerCard.jsx      # Automation trigger config (per-prayer/per-event)
│   ├── DynamicField.jsx     # Metadata-driven form field renderer
│   ├── VoiceLibrary.jsx     # TTS voice browser with preview (589 lines)
│   ├── SourceConfigurator.jsx # Prayer source configuration
│   ├── OutputStrategyCard.jsx # Audio output strategy config
│   ├── automation/          # 3 tab components for automation settings
│   │   ├── AutomationGeneralTab.jsx
│   │   ├── AutomationOutputsTab.jsx
│   │   └── AutomationTriggersTab.jsx
│   └── developer/           # 7 components for developer settings
│       ├── DiagnosticsTab.jsx
│       ├── HealthTab.jsx
│       ├── SystemLogTab.jsx
│       └── ... (4 more)
├── layout/
│   ├── SettingsLayout.jsx   # Sidebar nav + global actions (440 lines)
│   └── ProtectedRoute.jsx   # Auth guard wrapper
└── common/
    ├── ConfirmModal.jsx     # Generic confirmation dialog
    ├── SaveProcessModal.jsx # Settings save progress with SSE
    ├── AudioTestModal.jsx   # Audio output testing
    ├── SearchableSelect.jsx # Searchable dropdown
    ├── PasswordInput.jsx    # Password with visibility toggle
    └── WelcomeModal.jsx     # Onboarding modal
```

## COMPONENT CATEGORIES

| Category             | Count | Purpose                 | State Source                                               |
| :------------------- | :---- | :---------------------- | :--------------------------------------------------------- |
| dashboard/           | 2     | Prayer time display.    | Props from App.jsx (via usePrayerTimes).                   |
| settings/            | ~10+  | Configuration UI.       | Context via useSettings(), useProviders(), useConstants(). |
| settings/automation/ | 3     | Automation config tabs. | Props from AutomationSettingsView.                         |
| settings/developer/  | 7     | Developer tools tabs.   | Props from DeveloperSettingsView.                          |
| layout/              | 2     | App structure.          | Mixed props + context.                                     |
| common/              | 6     | Reusable shared UI.     | Props only (no context dependency).                        |

## PATTERNS

- **DynamicField**: Renders form fields from output strategy metadata (select, text, number, toggle). Strategies define their own config fields.
- **TriggerCard**: Renders per-prayer or per-event trigger config. Supports adhan/iqamah/dua events with source selection.
- **Controlled/uncontrolled dual-mode**: VoiceLibrary accepts external state (selectedVoice, onSelect) or manages internally.
- **Tab suffix convention**: Tab components (AutomationGeneralTab, DiagnosticsTab) are sub-views within a parent settings view.

## CONVENTIONS

- **Common components are props-only**: No context hooks inside common/ directory.
- **Dashboard components**: Receive all data as props from App.jsx.
- **Settings components**: May use useSettings() context directly.
- **Icons**: lucide-react exclusively.
- **Class merging**: cn() utility (clsx + tailwind-merge).

## ANTI-PATTERNS

- **No context in common/**: Don't add context dependencies to common/ components.
- **No external icons**: Don't create new icon imports from non-lucide libraries.
- **No manual classes**: Don't bypass the cn() utility for conditional class names.
