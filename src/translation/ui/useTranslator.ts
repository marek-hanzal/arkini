import { useContext } from "react";

import { TranslationContext } from "~/translation/ui/TranslationContext";

export const useTranslator = () => {
	const translator = useContext(TranslationContext);
	if (translator === undefined) throw new Error("TranslationContext is missing.");
	return translator;
};
