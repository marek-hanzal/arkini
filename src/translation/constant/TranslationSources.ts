import type { TranslationSource } from "~/translation/type/TranslationSource";

/** Literal call sites owned by the offline translation extractor. */
export const TranslationSources = {
	jsx: [
		{
			name: "Tx",
			attr: "label",
		},
		{
			name: "Mx",
			attr: "label",
		},
	],
	functions: [],
	objects: [
		{
			object: "translator",
			name: "textFn",
		},
	],
} as const satisfies TranslationSource.Sources;
