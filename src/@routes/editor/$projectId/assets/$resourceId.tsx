import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId")({
	component: Outlet,
});
