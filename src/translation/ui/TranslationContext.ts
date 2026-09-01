import { createContext } from "react";

import { translator } from "~/translation/constant/translator";

/** React projection of the same default translator available to plain modules. */
export const TranslationContext = createContext(translator);
