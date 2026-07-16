import { createFileRoute } from "@tanstack/react-router";
import { GamePage } from "~/page/game/GamePage";

export const Route = createFileRoute("/game/")({
	component: GamePage,
});
