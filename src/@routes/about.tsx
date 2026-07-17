import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "~/page/launcher/AboutPage";

export const Route = createFileRoute("/about")({
	component: AboutPage,
});
