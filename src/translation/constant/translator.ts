import { EnglishTranslations } from "~/translation/constant/EnglishTranslations";
import { createTranslatorFn } from "~/translation/fn/createTranslatorFn";

/** Default process-local translator shared by plain modules and the React root. */
export const translator = createTranslatorFn({
	translations: EnglishTranslations,
});
