({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=(function () {
'use strict';
window.unbound.storage.getStore('unbound.show-hidden-things');
var unpatches = [];
var index = {
    start: function start() {
        console.log("[Show Hidden Things] loaded");
    },
    stop: function stop() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = unpatches[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var unpatch = _step.value;
                unpatch();
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
        unpatches = [];
    },
    getSettingsPanel: function getSettingsPanel() {
        return null;
    }
};
return index;
})();return this.__plugin;},start(){const plugin=this.__load();if(plugin&&typeof plugin.start==='function')return plugin.start();},stop(){const plugin=this.__load();if(plugin&&typeof plugin.stop==='function')return plugin.stop();},getSettingsPanel(){const plugin=this.__load();return plugin?.getSettingsPanel?.();}})