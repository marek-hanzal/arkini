import { Outlet } from "@tanstack/react-router";
import { AppearanceControl } from "~/ui/appearance/AppearanceControl";
import { Canvas } from "~/ui/canvas/Canvas";
import { GameOwnerProvider } from "~/ui/shell/GameOwnerProvider";

export function RootPage() {
	return (
		<GameOwnerProvider>
			<Canvas>
				<Outlet />
				<AppearanceControl />
			</Canvas>
		</GameOwnerProvider>
	);
}
