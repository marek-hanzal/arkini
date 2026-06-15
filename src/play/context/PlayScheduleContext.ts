import { createContext } from "react";
import type { usePlayEventQueue } from "~/play/hook/usePlayEventQueue";

export const PlayScheduleContext = createContext<ReturnType<typeof usePlayEventQueue> | null>(null);
