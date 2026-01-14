import React from 'react';
import { DateTime } from 'luxon';

const PrayerRow = ({ name, time, iqamah, status }) => {
    const baseClass = "flex items-center justify-between py-3 px-4 lg:py-6 lg:px-10 text-2xl lg:text-5xl font-medium border-b border-white/5 last:border-0 transition-all duration-500";
    
    let colorClass = "text-white";
    let bgClass = "";
    
    if (status === 'passed') {
        colorClass = "text-app-dim";
    }
    if (status === 'next') {
        colorClass = "text-app-accent font-bold";
        bgClass = "bg-app-accent/10";
    }

    const label = name.charAt(0).toUpperCase() + name.slice(1);
    const formatTime = (iso) => iso ? DateTime.fromISO(iso).toFormat('h:mm') : '-';

    return (
        <div className={`${baseClass} ${colorClass} ${bgClass}`}>
            <span className="w-1/3 text-left">{label}</span>
            <span className="w-1/3 text-center">{formatTime(time)}</span>
            <span className="w-1/3 text-right text-xl lg:text-4xl opacity-60">{iqamah ? formatTime(iqamah) : ''}</span>
        </div>
    );
};

const PrayerCard = ({ prayers, nextPrayer }) => {
    const prayerList = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    
    const getStatus = (key) => {
        if (!nextPrayer) return 'future';
        
        const idx = prayerList.indexOf(key);
        const nextIdx = prayerList.indexOf(nextPrayer.name);
        
        if (nextPrayer.isTomorrow) {
            return 'passed';
        }
        
        if (idx < nextIdx) return 'passed';
        if (idx === nextIdx) return 'next';
        return 'future'; 
    };

    return (
        <div className="bg-app-card rounded-3xl h-auto lg:h-full flex flex-col overflow-hidden shadow-2xl p-4">
            <div className="flex-1 flex flex-col justify-center space-y-2">
                 <div className="flex justify-between px-4 lg:px-10 pb-4 text-app-dim text-sm lg:text-xl uppercase tracking-widest font-semibold opacity-50 border-b border-white/5">
                     <span className="w-1/3 text-left">Prayer</span>
                     <span className="w-1/3 text-center">Start Time</span>
                     <span className="w-1/3 text-right">Iqamah</span>
                 </div>
                 {prayerList.map(key => (
                     <PrayerRow 
                        key={key} 
                        name={key} 
                        time={prayers[key]?.start} 
                        iqamah={prayers[key]?.iqamah}
                        status={getStatus(key)}
                     />
                 ))}
            </div>
        </div>
    );
};

export default PrayerCard;
