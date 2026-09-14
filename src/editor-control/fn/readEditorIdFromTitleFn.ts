/** Derives an authoring ID from title words without changing punctuation. */
export const readEditorIdFromTitleFn = (title: string): string =>
	title.trim().toLowerCase().split(/\s+/).join("-");
