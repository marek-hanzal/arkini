import { createContext } from "react";
import type { ActionLoadingControl } from "~/ui/loading/ActionLoadingControl";

export const ActionLoadingContext = createContext<ActionLoadingControl.Type | null>(null);
