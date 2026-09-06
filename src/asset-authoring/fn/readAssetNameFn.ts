/** Converts an asset ID into its human-readable editor name. */
export const readAssetNameFn = (id: string) =>
	id.replaceAll(/[-_]+/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
