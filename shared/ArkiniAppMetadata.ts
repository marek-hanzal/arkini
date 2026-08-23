import packageJson from "../package.json";

/** Build metadata sourced exclusively from the root package manifest. */
export const ArkiniAppVersion = packageJson.version;
export const ArkiniDefaultPackageId = "arkini";
export const ArkiniWindowTitle = `Arkini v${ArkiniAppVersion}`;
