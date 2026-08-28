import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_launcher/settings/")({
	beforeLoad: () => {
		throw redirect({
			to: "/settings/common",
			replace: true,
		});
	},
});
