/** Converts a resource ID into its human-readable editor name. */
export const readResourceNameFn = (id: string) =>
	id.replaceAll(/[-_]+/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
