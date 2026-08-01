import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/editor/$projectId/editor/items/$itemUid/create/",
)({
	loader: ({ location, params }) => {
		throw redirect({
			to: "/editor/$projectId/editor/items/$itemUid/create/identity",
			params,
			search: location.search,
			replace: true,
		});
	},
});
