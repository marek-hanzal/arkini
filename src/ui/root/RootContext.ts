import type { QueryClient } from "@tanstack/react-query";
import type { CheatAvailability } from "~/bridge/cheat/CheatAvailability";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";

/** Shared router context assembled at the renderer root. */
export interface RootContext {
	readonly cheatAvailability: CheatAvailability;
	readonly launcherStartup: LauncherStartup;
	readonly previousGameShutdown: Promise<void>;
	readonly queryClient: QueryClient;
}
