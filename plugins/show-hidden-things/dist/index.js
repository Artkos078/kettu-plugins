({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=(function () {
'use strict';
var index = {
    start: function start() {
        console.log("[Show Hidden Things] plugin started");
    },
    stop: function stop() {
        console.log("[Show Hidden Things] plugin stopped");
    }
};
return index;
})();return this.__plugin;},start(){const plugin=this.__load();if(plugin&&typeof plugin.start==='function')return plugin.start();},stop(){const plugin=this.__load();if(plugin&&typeof plugin.stop==='function')return plugin.stop();},getSettingsPanel(){const plugin=this.__load();return plugin?.getSettingsPanel?.();}})