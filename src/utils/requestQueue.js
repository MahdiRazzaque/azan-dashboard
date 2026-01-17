const Bottleneck = require('bottleneck');

/**
 * Aladhan API Queue
 * Observed Limit: ~536 RPM | Safe Limit: 300 RPM (5 req/s)
 * Burst: ~15 | Safe Burst: 10
 */
const aladhanQueue = new Bottleneck({
    minTime: 0,
    maxConcurrent: 5,
    reservoir: 10,
    reservoirRefreshAmount: 5,
    reservoirRefreshInterval: 1000 // 5 req/s = 300 RPM
});

/**
 * MyMasjid API Queue
 * Observed Limit: ~120 RPM | Safe Limit: 100 RPM
 * Burst: ~20 | Safe Burst: 15
 */
const myMasjidQueue = new Bottleneck({
    minTime: 0,
    maxConcurrent: 5,
    reservoir: 15,
    reservoirRefreshAmount: 10,
    reservoirRefreshInterval: 6000 // 10 req / 6s = 100 RPM
});

/**
 * VoiceMonkey API Queue
 * Observed Limit: Blocked after 170 reqs (15 min ban).
 * Safe Limit: 150 req / 15 min = 10 RPM.
 */
const voiceMonkeyQueue = new Bottleneck({
    minTime: 0,
    maxConcurrent: 5,
    reservoir: 5,
    reservoirRefreshAmount: 10,
    reservoirRefreshInterval: 60000 // 10 req / min
});

// Log queue status if needed for debugging
aladhanQueue.on('failed', (error, jobInfo) => {
    console.warn(`[Queue:Aladhan] Job ${jobInfo.options.id} failed: ${error.message}`);
});

myMasjidQueue.on('failed', (error, jobInfo) => {
    console.warn(`[Queue:MyMasjid] Job ${jobInfo.options.id} failed: ${error.message}`);
});

voiceMonkeyQueue.on('failed', (error, jobInfo) => {
    console.warn(`[Queue:VoiceMonkey] Job ${jobInfo.options.id} failed: ${error.message}`);
});

module.exports = {
    aladhanQueue,
    myMasjidQueue,
    voiceMonkeyQueue
};
