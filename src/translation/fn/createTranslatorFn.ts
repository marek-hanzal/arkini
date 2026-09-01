import type { TranslationListSchema } from "~/translation/schema/TranslationListSchema";

export namespace createTranslatorFn {
	export interface Value {
		readonly text: string;
		readonly type: "translation" | "fallback" | "key";
	}

	export interface Translator {
		textFn(key: string, fallback?: string): string;
		valueFn(key: string, fallback?: string): Value;
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
	const valueFn = (key: string, fallback?: string): createTranslatorFn.Value => {
		const translation = index.get(key);
		if (translation !== undefined) {
			return {
				text: translation,
				type: "translation",
			};
		}
		if (fallback !== undefined) {
			return {
				text: fallback,
				type: "fallback",
			};
		}
		return {
			text: key,
			type: "key",
		};
	};
	return Object.freeze({
		valueFn,
		textFn(key: string, fallback?: string) {
			return valueFn(key, fallback).text;
		},
	});
};
