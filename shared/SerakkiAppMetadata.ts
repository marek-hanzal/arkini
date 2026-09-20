import packageJson from "../package.json";

/** Build metadata sourced exclusively from the root package manifest. */
export const SerakkiAppVersion = packageJson.version;
export const SerakkiDefaultPackageId = "serakki";
export const SerakkiWindowTitle = `Serakki v${SerakkiAppVersion}`;
