export const dashboardTourSteps = [
  {
    element: "#tour-focus-card",
    popover: {
      title: "Stay Focused",
      description:
        "View the current time and a clear, distraction-free countdown to the next upcoming prayer.",
    },
  },
  {
    element: "#tour-prayer-card",
    popover: {
      title: "Daily Schedule",
      description:
        "See today's complete schedule at a glance. Past prayers fade out, whilst the next prayer is clearly highlighted.",
    },
  },
  {
    element: "#tour-wake-lock",
    popover: {
      title: "Screen Wake Lock",
      description:
        "Prevent your device from going to sleep. This is perfect if you are using a tablet or TV as a dedicated wall display.",
    },
  },
  {
    element: "#tour-mute-btn",
    popover: {
      title: "Local Audio Control",
      description:
        "Mute or unmute the automated audio specifically for this device. This does not affect other screens or external speakers.",
    },
  },
  {
    element: "#tour-display-settings",
    popover: {
      title: "Client Settings",
      description:
        "Customise the visual theme, clock format, and set granular audio exclusion rules for this specific screen.",
    },
  },
  {
    element: "#tour-admin-settings",
    popover: {
      title: "System Administration",
      description:
        "Access the master configuration panel to manage schedules, integrations, and server-wide settings. (Requires the Admin password).",
    },
  },
];

export const adminTourSteps = [
  {
    element: "#tour-nav-general",
    popover: {
      title: "General Configuration",
      description:
        "Set your geographic location and choose your primary and backup prayer time data sources (e.g., Aladhan or MyMasjid).",
    },
  },
  {
    element: "#tour-nav-prayers",
    popover: {
      title: "Timing & Triggers",
      description:
        "Configure Iqamah calculations (offsets or fixed times) and set up specific audio triggers (Pre-Adhan, Adhan, Iqamah) for each prayer.",
    },
  },
  {
    element: "#tour-nav-automation",
    popover: {
      title: "Automation & Outputs",
      description:
        "Manage your global master switches, configure external output devices like Alexa, and preview the Text-to-Speech voice library.",
    },
  },
  {
    element: "#tour-nav-files",
    popover: {
      title: "Audio Assets",
      description:
        "Upload your own custom MP3s, preview audio directly in the browser, and review compatibility warnings for external integrations.",
    },
  },
  {
    element: "#tour-nav-credentials",
    popover: {
      title: "Security",
      description:
        "Securely manage integration API keys and update your master administrator password.",
    },
  },
  {
    element: "#tour-nav-developer",
    popover: {
      title: "Diagnostics & Maintenance",
      description:
        "Monitor overall system health, view live server logs, manually trigger maintenance jobs, and manage storage quotas.",
    },
  },
];
