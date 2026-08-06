/** @type {import('@rtk-query/codegen-openapi').ConfigFile} */
const config = {
  schemaFile: "../backend/generated/openapi.json",
  apiFile: "./src/api/base-api.ts",
  apiImport: "baseApi",
  outputFile: "./src/api/generated/api.ts",
  exportName: "generatedApi",
  hooks: true,
};

export default config;
