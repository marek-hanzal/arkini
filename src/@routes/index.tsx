import { createFileRoute, redirect } from "@tanstack/react-router";
import { StartupPage } from "~/page/launcher/StartupPage";

export const Route = createFileRoute("/")({
	beforeLoad: ({ context }) => {
		if (context.launcherStartup.getSnapshot().splashCompleted) {
			throw redirect({
				to: "/main-menu",
			});
		}
	},
	component: StartupPage,
});
