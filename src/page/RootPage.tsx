import type { QueryClient } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { Canvas } from "~/ui/canvas/Canvas";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";

export namespace RootPage {
	export interface Context {
		readonly launcherStartup: LauncherStartup;
		readonly previousGameShutdown: Promise<void>;
		readonly queryClient: QueryClient;
	}
}

export function RootPage() {
	return (
		<Canvas>
			<Outlet />
		</Canvas>
	);
}
