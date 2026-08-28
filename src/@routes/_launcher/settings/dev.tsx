import { createFileRoute } from "@tanstack/react-router";

import { SettingsDevPage } from "~/page/settings/SettingsDevPage";

export const Route = createFileRoute("/_launcher/settings/dev")({
	component: SettingsDevPage,
});
