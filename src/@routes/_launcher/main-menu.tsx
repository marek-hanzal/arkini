import { createFileRoute } from "@tanstack/react-router";
import { MainMenuPage } from "~/page/launcher/MainMenuPage";

export const Route = createFileRoute("/_launcher/main-menu")({
	component: MainMenuPage,
});
