import { createFileRoute } from "@tanstack/react-router";
import { ArkpackSelectorPage } from "~/page/arkpack/ArkpackSelectorPage";

export const Route = createFileRoute("/arkpacks")({
	component: ArkpackSelectorPage,
});
