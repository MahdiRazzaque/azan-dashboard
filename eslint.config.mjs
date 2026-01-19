import jsdoc from "eslint-plugin-jsdoc";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  // 1. Global Ignores
  {
    ignores: ["node_modules/", "dist/", "client/dist/", "coverage/"],
  },

  // =========================================================
  // BACKEND RULES (src folder)
  // =========================================================
  {
    files: ["src/**/*.js"],
    languageOptions: {
      globals: globals.node, // Node.js global variables (process, __dirname)
    },
    plugins: { jsdoc },
    rules: {
      // Strict JSDoc for Backend
      "jsdoc/require-jsdoc": [
        "warn",
        {
          "contexts": [
            "FunctionDeclaration",
            "MethodDefinition",
            "VariableDeclarator > ArrowFunctionExpression",
            "VariableDeclarator > FunctionExpression",
            "Property > ArrowFunctionExpression",
            "Property > FunctionExpression"
          ]
        }
      ],
      "jsdoc/require-description": "warn",
      "jsdoc/check-param-names": "error",
      "spaced-comment": ["error", "always"],
    },
  },

  // =========================================================
  // FRONTEND RULES (client folder)
  // =========================================================
  {
    files: ["client/src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser, // Browser globals (window, document)
      parserOptions: {
        ecmaFeatures: { jsx: true }, // Enable JSX parsing
        sourceType: "module",
      },
    },
    // Define React settings manually since we are in flat config
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      jsdoc, // We keep JSDoc available, but relaxed
    },
    rules: {
      // --- React Core Rules ---
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      
      "react/react-in-jsx-scope": "off", // Not needed in Vite/React 17+
      "react/prop-types": "off",         // Turn "warn" if you want to force prop validation
      "react/jsx-no-target-blank": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // --- Relaxed JSDoc for Client ---
      // We ONLY require JSDoc for "hooks" and "utils", not components
      "jsdoc/require-jsdoc": ["warn", {
          contexts: [
            // Only check functions inside hooks/ or utils/ folders
            "Program > VariableDeclaration > VariableDeclarator[id.name=/^use/] > ArrowFunctionExpression", // Custom Hooks
          ]
      }],
      
      // Allow TODOs in client, but ensure inline comments have spaces
      "spaced-comment": ["error", "always"],
    },
  },
];