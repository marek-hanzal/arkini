import { createContext } from "react";

import type { createTranslatorFn } from "~/translation/fn/createTranslatorFn";

/** React projection of the translator selected during renderer bootstrap. */
export const TranslationContext = createContext<createTranslatorFn.Translator | undefined>(
	undefined,
);
