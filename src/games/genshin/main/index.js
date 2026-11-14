// Main-process modules of this game; channels are registered under the 'genshin:' prefix.
require('./getData')
require('./excel')
require('./UIGFJson')
require('./icons')
require('./collectionExtra')
module.exports = require('../../../main/vendor/system-proxy')
