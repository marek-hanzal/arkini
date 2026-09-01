import { Effect } from "effect";

import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { TranslationPreferencesReadError } from "~/translation/error/TranslationPreferencesReadError";
import type { createTranslatorFn } from "~/translation/fn/createTranslatorFn";
import { loadTranslatorFx } from "~/translation/fx/loadTranslatorFx";
import { setTranslatorFx, translator } from "~/translation/service/translator";

export namespace bootstrapTranslationFx {
	export interface Props {
		readonly localization: Pick<
			ArkiniElectronApi.Api["localization"],
			"readPreferredLanguagesFn"
		>;
	}

	export interface Result {
		readonly locale: string;
		readonly translator: createTranslatorFn.Translator;
	}
}

/** Selects and publishes the one renderer translation catalog before consumers start. */
export const bootstrapTranslationFx = Effect.fn("bootstrapTranslationFx")(function* ({
	localization,
}: bootstrapTranslationFx.Props) {
	const preferredLocales = yield* Effect.tryPromise({
		try: () => localization.readPreferredLanguagesFn(),
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
