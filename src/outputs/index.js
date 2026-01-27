const OutputFactory = require('./OutputFactory');

// Register strategies
require('./LocalOutput');
require('./VoiceMonkeyOutput');
require('./BrowserOutput');
require('./TestOutput');

module.exports = OutputFactory;
