import type { TranslationSchema } from "~/translation/schema/TranslationSchema";

export namespace createTranslatorFn {
	export interface Value {
		readonly text: string;
		readonly type: "translation" | "fallback" | "key";
	}

	export interface Translator {
		listFn(): readonly TranslationSchema.Type[];
		textFn(key: string, fallback?: string): string;
		valueFn(key: string, fallback?: string): Value;
	}

	export interface Props {
		readonly translations: readonly TranslationSchema.Type[];
	}
}

/** Builds one immutable exact-key translation index from a validated locale catalog. */
export const createTranslatorFn = ({
	translations,
}: createTranslatorFn.Props): createTranslatorFn.Translator => {
	const entries = Object.freeze(
		translations.map((translation) =>
			Object.freeze({
				...translation,
			}),
		),
	);
	const index = new Map(
		entries.map((translation) => [
			translation.key,
			translation,
		]),
	);
	const valueFn = (key: string, fallback?: string): createTranslatorFn.Value => {
		const translation = index.get(key);
		if (translation !== undefined) {
			return {
				text: translation.value,
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
		listFn: () => entries,
		valueFn,
		textFn(key: string, fallback?: string) {
			return valueFn(key, fallback).text;
		},
	});
};
