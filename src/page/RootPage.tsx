import { Outlet } from "@tanstack/react-router";
import { Canvas } from "~/ui/canvas/Canvas";
import { GameOwnerProvider } from "~/ui/shell/GameOwnerProvider";

export function RootPage() {
	return (
		<GameOwnerProvider>
			<Canvas>
				<Outlet />
			</Canvas>
		</GameOwnerProvider>
	);
}
