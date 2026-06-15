import { createContext } from "react";
import type { usePlaySheets } from "~/play/hook/usePlaySheets";

export const PlaySheetsContext = createContext<ReturnType<typeof usePlaySheets> | null>(null);
