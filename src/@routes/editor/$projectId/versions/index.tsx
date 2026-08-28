import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/$projectId/versions/")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/editor/$projectId/versions/commit",
			params,
			replace: true,
		});
	},
});
