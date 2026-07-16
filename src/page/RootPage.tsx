import { Outlet } from "@tanstack/react-router";
import { Canvas } from "~/ui/canvas/Canvas";

export function RootPage() {
	return (
		<Canvas>
			<Outlet />
		</Canvas>
	);
}
