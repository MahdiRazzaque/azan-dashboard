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
      globals: globals.node,
    },
    plugins: { jsdoc },
    rules: {
      // --- Strict JSDoc for Backend ---
      
      // 1. Force the JSDoc block to exist
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

      // 2. Force @param consistency and existence
      "jsdoc/check-param-names": "error",      // Checks name matching
      "jsdoc/require-param": "warn",           // Forces @param tag to exist
      "jsdoc/require-param-type": "warn",      // Forces {type}
      "jsdoc/require-param-description": "warn", // Forces description text

      // 3. Force @returns existence
      "jsdoc/require-returns": "warn",         // Forces @returns tag (even for void)
      "jsdoc/require-returns-type": "warn",    // Forces {type}
      "jsdoc/require-returns-description": "warn", // Force return desc

      // Misc
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
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      jsdoc,
    },
    rules: {
      // --- React Core Rules ---
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/jsx-no-target-blank": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // --- JSDoc Rules for Hooks ---
      
      // 1. Force JSDoc block ONLY on Hooks (starting with 'use')
      "jsdoc/require-jsdoc": ["warn", {
          contexts: [
            // Hooks usually declared as const useHook = () => ...
            "Program > VariableDeclaration > VariableDeclarator[id.name=/^use/] > ArrowFunctionExpression",
            "Program > VariableDeclaration > VariableDeclarator[id.name=/^use/] > FunctionExpression",
            // Hooks declared as function useHook() {}
            "FunctionDeclaration[id.name=/^use/]" 
          ]
      }],

      // 2. If it is a hook, enforce params
      "jsdoc/check-param-names": "error",
      "jsdoc/require-param": "warn",
      "jsdoc/require-param-type": "warn",
      
      // 3. If it is a hook, enforce returns
      "jsdoc/require-returns": "warn",
      "jsdoc/require-returns-type": "warn",

      "spaced-comment": ["error", "always"],
    },
  },
];