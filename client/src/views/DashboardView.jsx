import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import WelcomeModal from '@/components/common/WelcomeModal';
import { useTour } from '@/hooks/useTour';
import { dashboardTourSteps } from '@/config/tourSteps';
import { useSettings } from '@/hooks/useSettings';
import DashboardLayout from '@/components/layout/DashboardLayout';
import TopControls from '@/components/layout/TopControls';
import PrayerCard from '@/components/dashboard/PrayerCard';
import FocusCard from '@/components/dashboard/FocusCard';

const DashboardView = ({
    prayers,
    viewedPrayers,
    nextPrayer,
    lastUpdated,
    isMuted,
    toggleMute,
    blocked,
    onCountdownComplete,
    viewedDate,
    referenceDate,
    onNavigateDay,
    onResetToToday,
    canNavigateBackward,
    canNavigateForward,
    transitionDirection,
    isTransitioning,
    timezone
}) => {
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const initialLoadRef = useRef(true);
    const { config, refresh } = useSettings();
    const { startTour, stopTour } = useTour();

    const handleTourComplete = useCallback(() => {
      fetch('/api/settings/tour-state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardSeen: true }),
      }).then(() => refresh()).catch(() => {});
    }, [refresh]);

    const handleStartTour = useCallback(() => {
      flushSync(() => setShowWelcomeModal(false));
      requestAnimationFrame(() => startTour('dashboard', dashboardTourSteps, handleTourComplete));
    }, [startTour, handleTourComplete]);

    const handleSkipTour = useCallback(() => {
      fetch('/api/settings/tour-state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardSeen: true }),
      }).then(() => { setShowWelcomeModal(false); refresh(); }).catch(() => { setShowWelcomeModal(false); });
    }, [refresh]);

    useEffect(() => {
      if (config?.system?.tours?.dashboardSeen === false && initialLoadRef.current) {
        requestAnimationFrame(() => setShowWelcomeModal(true));
      }
      if (config !== undefined) {
        initialLoadRef.current = false;
      }
    }, [config]);

    useEffect(() => () => stopTour(), [stopTour]);

    return (
        <div className="relative h-screen w-screen overflow-y-auto lg:overflow-hidden bg-app-bg text-app-text font-sans antialiased selection:bg-app-accent selection:text-app-bg" style={{ WebkitOverflowScrolling: 'touch' }}>
            {showWelcomeModal && <WelcomeModal onStartTour={handleStartTour} onSkip={handleSkipTour} />}
            <TopControls isMuted={isMuted} toggleMute={toggleMute} blocked={blocked} />
            <DashboardLayout>
                <PrayerCard
                    prayers={viewedPrayers || prayers}
                    nextPrayer={nextPrayer}
                    viewedDate={viewedDate}
                    referenceDate={referenceDate}
                    onNavigate={onNavigateDay}
                    onResetToday={onResetToToday}
                    canNavigateBackward={canNavigateBackward}
                    canNavigateForward={canNavigateForward}
                    transitionDirection={transitionDirection}
                    isTransitioning={isTransitioning}
                />
                <FocusCard
                    nextPrayer={nextPrayer}
                    prayers={prayers}
                    lastUpdated={lastUpdated}
                    onCountdownComplete={onCountdownComplete}
                    timezone={timezone}
                />
            </DashboardLayout>
        </div>
    );
};

export default DashboardView;
