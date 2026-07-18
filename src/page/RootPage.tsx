import { Outlet } from "@tanstack/react-router";
import { Canvas } from "~/ui/canvas/Canvas";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { ActionLoadingProvider } from "~/ui/loading/ActionLoadingProvider";
import { GameOwnerProvider } from "~/ui/shell/GameOwnerProvider";

export namespace RootPage {
	export interface Context {
		readonly launcherStartup: LauncherStartup;
	}
}

export function RootPage() {
	return (
		<ActionLoadingProvider>
			<GameOwnerProvider>
				<Canvas>
					<Outlet />
				</Canvas>
			</GameOwnerProvider>
		</ActionLoadingProvider>
	);
}
