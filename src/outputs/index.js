const OutputFactory = require('./OutputFactory');
const LocalOutput = require('./LocalOutput');
const VoiceMonkeyOutput = require('./VoiceMonkeyOutput');
const BrowserOutput = require('./BrowserOutput');

// Explicitly register all output strategies to avoid module side-effects
OutputFactory.register(LocalOutput);
OutputFactory.register(VoiceMonkeyOutput);
OutputFactory.register(BrowserOutput);

module.exports = OutputFactory;
