import type { TranslationListSchema } from "~/translation/schema/TranslationListSchema";

export namespace createTranslatorFn {
	export interface Translator {
		textFn(key: string, fallback?: string): string;
	}

	export interface Props {
		readonly translations: TranslationListSchema.Type;
	}
}

/** Builds one immutable exact-key translation index from a validated locale catalog. */
export const createTranslatorFn = ({
	translations,
}: createTranslatorFn.Props): createTranslatorFn.Translator => {
	const index = new Map(
		Object.entries(translations).map(([key, translation]) => [
			key,
			translation.value,
		]),
	);
	return Object.freeze({
		textFn(key: string, fallback?: string) {
			return index.get(key) ?? fallback ?? key;
		},
	});
};
