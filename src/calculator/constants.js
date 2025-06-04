// constants.js

// Based on Aladhan API documentation
// https://aladhan.com/prayer-times-api
export const CALCULATION_METHODS = {
    0: "Jafari (Shia Ithna Ashari)",
    1: "University of Islamic Sciences, Karachi",
    2: "Islamic Society of North America (ISNA)",
    3: "Muslim World League (MWL)",
    4: "Umm al-Qura University, Makkah",
    5: "Egyptian General Authority of Survey",
    7: "Institute of Geophysics, University of Tehran",
    8: "Gulf Region",
    9: "Kuwait",
    10: "Qatar",
    11: "Majlis Ugama Islam Singapura, Singapore",
    12: "Union Organization Islamic de France",
    13: "Diyanet İşleri Başkanlığı, Turkey",
    14: "Spiritual Administration of Muslims of Russia",
    15: "Moonsighting Committee Worldwide (MWC)", 
    16: "Dubai (experimental)",
    17: "Jabatan Kemajuan Islam Malaysia (JAKIM)",
    18: "Tunisia",
    19: "Algeria",
    20: "Kementerian Agama Republik Indonesia (Kemenag)",
    21: "Morocco",
    22: "Comunidade Islamica de Lisboa, Portugal",
    23: "Ministry of Awqaf, Islamic Affairs and Holy Places, Jordan",
};

export const ASR_JURISTIC_METHODS = { // Maps to 'school' parameter
    0: "Standard/Shafi'i (Default)", // Shafi, Maliki, Hanbali
    1: "Hanafi"
};

export const LATITUDE_ADJUSTMENT_METHODS = {
    1: "Middle of the Night",
    2: "One Seventh of the Night",
    3: "Angle Based",
    // 'NONE' will be handled by not sending the parameter
};

export const MIDNIGHT_MODES = {
    0: "Standard (Mid Sunset to Sunrise)",
    1: "Jafari (Mid Sunset to Fajr)"
};

export const IQAMAH_PRAYERS = ["fajr", "zuhr", "asr", "maghrib", "isha"];

export const API_BASE_URL = "http://api.aladhan.com/v1";

export const CONFIG_FILE = "prayer_config.json";
export const OUTPUT_FILE = "prayer_times.json";