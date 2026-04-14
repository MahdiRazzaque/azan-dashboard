const path = require("path");
const root = path.resolve(__dirname, "..");

module.exports = {
  resolve: {
    alias: {
      "@adapters": path.join(root, "src/adapters"),
      "@providers": path.join(root, "src/providers"),
      "@config": path.join(root, "src/config"),
      "@outputs": path.join(root, "src/outputs"),
      "@services": path.join(root, "src/services"),
      "@utils": path.join(root, "src/utils"),
      "@controllers": path.join(root, "src/controllers"),
      "@middleware": path.join(root, "src/middleware"),
      "@routes": path.join(root, "src/routes"),
    },
  },
};
