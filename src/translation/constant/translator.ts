import EnglishTranslationSource from "~/translation/en.yaml";
import { createTranslatorFn } from "~/translation/fn/createTranslatorFn";
import type { TranslationListSchema } from "~/translation/schema/TranslationListSchema";

/** Default process-local translator shared by plain modules and the React root. */
export const translator = createTranslatorFn({
	translations: EnglishTranslationSource as TranslationListSchema.Type,
});
