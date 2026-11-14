// Main-process modules of this game; channels are registered under the 'starrail:' prefix.
require('./getData')
require('./bridge')
require('./excel')
require('./UIGFJson')
require('./banners')
require('./icons')
require('./collectionExtra')
module.exports = require('../../../main/vendor/system-proxy')
