import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Canvas } from "~/ui/canvas/Canvas";
import { RootFatalErrorView } from "~/ui/root/RootFatalErrorView";
import type { RootContext } from "~/ui/root/RootContext";

export const Route = createRootRouteWithContext<RootContext>()({
	/** Mounting the root viewport must never imply a playable Game resource. */
	component: () => (
		<Canvas>
			<Outlet />
		</Canvas>
	),
	errorComponent: ({ error }) => <RootFatalErrorView error={error} />,
});
