import { createFileRoute } from "@tanstack/react-router";

import { DevPage } from "~/page/settings/DevPage";

export const Route = createFileRoute("/_launcher/settings/dev")({
	component: DevPage,
});
