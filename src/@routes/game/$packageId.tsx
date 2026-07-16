import { createFileRoute } from "@tanstack/react-router";
import { GameShellPage } from "~/page/game/GameShellPage";

export const Route = createFileRoute("/game/$packageId")({
	component: GameShellPage,
});
