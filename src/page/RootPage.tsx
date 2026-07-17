import { Outlet } from "@tanstack/react-router";
import { Canvas } from "~/ui/canvas/Canvas";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { GameOwnerProvider } from "~/ui/shell/GameOwnerProvider";

export namespace RootPage {
	export interface Context {
		readonly launcherStartup: LauncherStartup;
	}
}

export function RootPage() {
	return (
		<GameOwnerProvider>
			<Canvas>
				<Outlet />
			</Canvas>
		</GameOwnerProvider>
	);
}
