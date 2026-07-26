import { Outlet } from "@tanstack/react-router";
import { Canvas } from "~/ui/canvas/Canvas";

/**
 * Root React composition owns only the fixed renderer viewport and route outlet.
 * Application and Game resource lifetimes are established outside this page or
 * by descendant route gates; mounting the root must never imply a playable Game.
 */
export function RootPage() {
	return (
		<Canvas>
			<Outlet />
		</Canvas>
	);
}
