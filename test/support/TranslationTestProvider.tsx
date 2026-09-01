import type { FC, PropsWithChildren } from "react";

import { createTranslatorFn } from "~/translation/fn/createTranslatorFn";
import { TranslationContext } from "~/translation/ui/TranslationContext";

const TestTranslator = createTranslatorFn({
	translations: {},
});

/** Supplies key-fallback translation behavior to tests outside the renderer bootstrap. */
export const TranslationTestProvider: FC<PropsWithChildren> = ({ children }) => (
	<TranslationContext.Provider value={TestTranslator}>{children}</TranslationContext.Provider>
);
