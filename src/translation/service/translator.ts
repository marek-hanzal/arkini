import { Effect } from "effect";

import type { createTranslatorFn } from "~/translation/fn/createTranslatorFn";

let activeTranslator: createTranslatorFn.Translator | undefined;

/** Stable process-local translator shared by plain modules and the React root. */
export const translator: createTranslatorFn.Translator = Object.freeze({
	textFn: (key: string, fallback?: string) => {
		if (activeTranslator === undefined) {
			throw new Error("Translations are not initialized yet.");
		}
		return activeTranslator.textFn(key, fallback);
	},
	valueFn: (key: string, fallback?: string) => {
		if (activeTranslator === undefined) {
			throw new Error("Translations are not initialized yet.");
		}
		return activeTranslator.valueFn(key, fallback);
	},
});

/** Replaces the active catalog before translated application work begins. */
export const setTranslatorFx = Effect.fn("setTranslatorFx")(
	(nextTranslator: createTranslatorFn.Translator) =>
		Effect.sync(() => {
			activeTranslator = nextTranslator;
		}),
);
