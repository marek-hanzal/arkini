import packageJson from "../package.json";

/** Build metadata sourced exclusively from the root package manifest. */
export const ArkiniAppVersion = packageJson.version;
export const ArkiniMinimumInputVersion = "0.5.0";
export const ArkiniDefaultPackageId = "arkini";
export const ArkiniWindowTitle = `Arkini v${ArkiniAppVersion}`;
