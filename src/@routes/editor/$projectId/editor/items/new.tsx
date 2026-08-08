import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/$projectId/editor/items/new")({
	component: Outlet,
});
