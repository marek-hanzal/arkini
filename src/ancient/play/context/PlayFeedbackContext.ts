import { createContext } from "react";
import type { usePlayFeedback } from "~/play/hook/usePlayFeedback";

export const PlayFeedbackContext = createContext<usePlayFeedback.State | null>(null);
