import { createFileRoute } from "@tanstack/react-router";
import { MainMenuPage } from "~/page/launcher/MainMenuPage";

export const Route = createFileRoute("/main-menu")({
	component: MainMenuPage,
});
