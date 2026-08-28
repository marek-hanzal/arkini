import { createFileRoute } from "@tanstack/react-router";

import { GamePage } from "~/page/settings/GamePage";

export const Route = createFileRoute("/_launcher/settings/game")({
	component: GamePage,
});
