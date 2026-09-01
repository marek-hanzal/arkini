import { Effect } from "effect";

import type { readPreferredLanguagesFn } from "~electron/contract/localization/readPreferredLanguagesFn";
import { TranslationPreferencesReadError } from "~/translation/error/TranslationPreferencesReadError";
import type { createTranslatorFn } from "~/translation/fn/createTranslatorFn";
import { loadTranslatorFx } from "~/translation/fx/loadTranslatorFx";
import { setTranslatorFx, translator } from "~/translation/service/translator";

export namespace bootstrapTranslationFx {
	export interface Props {
		readonly readPreferredLanguagesFn: readPreferredLanguagesFn;
	}

	export interface Result {
		readonly locale: string;
		readonly translator: createTranslatorFn.Translator;
	}
}

/** Selects and publishes the one renderer translation catalog before consumers start. */
export const bootstrapTranslationFx = Effect.fn("bootstrapTranslationFx")(function* ({
	readPreferredLanguagesFn,
}: bootstrapTranslationFx.Props) {
	const preferredLocales = yield* Effect.tryPromise({
		try: () => readPreferredLanguagesFn(),
		catch: (cause) =>
			new TranslationPreferencesReadError({
				cause,
			}),
	});
	const selected = yield* loadTranslatorFx({
		preferredLocales,
	});
	yield* setTranslatorFx(selected.translator);
	return {
		locale: selected.locale,
		translator,
	} satisfies bootstrapTranslationFx.Result;
});
