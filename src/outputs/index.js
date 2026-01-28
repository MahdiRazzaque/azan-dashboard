const OutputFactory = require('./OutputFactory');

// Register strategies
require('./LocalOutput');
require('./VoiceMonkeyOutput');
require('./BrowserOutput');

module.exports = OutputFactory;
