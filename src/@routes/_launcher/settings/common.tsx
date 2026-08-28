import { createFileRoute } from "@tanstack/react-router";

import { SettingsCommonPage } from "~/page/settings/SettingsCommonPage";

export const Route = createFileRoute("/_launcher/settings/common")({
	component: SettingsCommonPage,
});
