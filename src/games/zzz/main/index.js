// Main-process modules of this game; channels are registered under the 'zzz:' prefix.
require('./getData')
require('./bridge')
require('./excel')
require('./UIGFJson')
require('./icons')
require('./collectionExtra')
module.exports = require('../../../main/vendor/system-proxy')
