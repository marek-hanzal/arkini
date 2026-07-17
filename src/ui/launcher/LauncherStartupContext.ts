import { createContext } from "react";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";

export const LauncherStartupContext = createContext<LauncherStartup | undefined>(undefined);
