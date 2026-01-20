import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import TopControls from '@/components/layout/TopControls';
import PrayerCard from '@/components/dashboard/PrayerCard';
import FocusCard from '@/components/dashboard/FocusCard';

const DashboardView = ({ prayers, nextPrayer, isMuted, toggleMute, blocked, onCountdownComplete }) => {
    return (
        <div className="relative h-screen w-screen overflow-y-auto lg:overflow-hidden bg-app-bg text-app-text font-sans antialiased selection:bg-app-accent selection:text-app-bg" style={{ WebkitOverflowScrolling: 'touch' }}>
            <TopControls isMuted={isMuted} toggleMute={toggleMute} blocked={blocked} />
            <DashboardLayout>
                <PrayerCard prayers={prayers} nextPrayer={nextPrayer} />
                <FocusCard nextPrayer={nextPrayer} prayers={prayers} onCountdownComplete={onCountdownComplete} />
            </DashboardLayout>
        </div>
    );
};

export default DashboardView;
