import { createFileRoute } from "@tanstack/react-router";

import { SettingsGamePage } from "~/page/settings/SettingsGamePage";

export const Route = createFileRoute("/_launcher/settings/game")({
	component: SettingsGamePage,
});
