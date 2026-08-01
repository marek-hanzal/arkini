import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/edit/")({
	loader: ({ params }) => {
		throw redirect({
			to: "/editor/$projectId/editor/items/$itemUid/edit/identity",
			params,
			replace: true,
		});
	},
});
