import { createContext } from "react";
import type { CheatAvailability } from "~/bridge/cheat/CheatAvailability";

export const CheatAvailabilityContext = createContext<CheatAvailability | undefined>(undefined);
