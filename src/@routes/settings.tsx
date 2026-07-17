import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "~/page/settings/SettingsPage";

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
});
