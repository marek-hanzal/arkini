import { createContext } from "react";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";

export const PlayVisualMotionsContext = createContext<useVisualItemMotions.State | null>(null);
