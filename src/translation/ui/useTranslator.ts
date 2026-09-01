import { useContext } from "react";

import { TranslationContext } from "~/translation/ui/TranslationContext";

export const useTranslator = () => useContext(TranslationContext);
