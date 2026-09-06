const pluginName = "Preview Message";

export default {
  start() {
    console.log(`[${pluginName}] compatibility plugin started`);
  },

  stop() {
    console.log(`[${pluginName}] compatibility plugin stopped`);
  }
};
