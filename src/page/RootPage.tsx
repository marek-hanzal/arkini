import { Outlet, useRouterState } from "@tanstack/react-router";
import { AppearanceControl } from "~/ui/appearance/AppearanceControl";
import { Canvas } from "~/ui/canvas/Canvas";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { GameOwnerProvider } from "~/ui/shell/GameOwnerProvider";

export namespace RootPage {
	export interface Context {
		readonly launcherStartup: LauncherStartup;
	}
}

export function RootPage() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	return (
		<GameOwnerProvider>
			<Canvas>
				<Outlet />
				{pathname === "/" ? null : <AppearanceControl />}
			</Canvas>
		</GameOwnerProvider>
	);
}
