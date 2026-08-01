import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/$projectId/editor/items/$itemUid/create/")({
	loaderDeps: ({ search }) => ({
		itemType: search.itemType,
	}),
	loader: ({ deps, params }) => {
		throw redirect({
			to: "/editor/$projectId/editor/items/$itemUid/create/identity",
			params,
			search: deps,
			replace: true,
		});
	},
});
