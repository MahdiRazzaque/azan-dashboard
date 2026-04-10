import { DateTime } from 'luxon';

const ARABIC_PRAYER_NAMES = {
  fajr: 'فجر',
  sunrise: 'شُروق',
  dhuhr: 'ظُهْر',
  asr: 'عصر',
  maghrib: 'مغرب',
  isha: 'عِشَا'
};

export const formatPrayerLabel = (name, language = 'english') => {
  if (!name) return '';
  if (language === 'arabic') {
    return ARABIC_PRAYER_NAMES[name] || name;
  }

  return name.charAt(0).toUpperCase() + name.slice(1);
};

export const formatPrayerTime = (iso, clockFormat = '24h') => {
  if (!iso) {
    return '-';
  }

  return DateTime.fromISO(iso).toFormat(clockFormat === '12h' ? 'h:mm a' : 'HH:mm');
};
