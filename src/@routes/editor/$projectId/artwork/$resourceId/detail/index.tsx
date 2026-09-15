import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/$projectId/artwork/$resourceId/detail/")({
	beforeLoad: ({ params, search }) => {
		throw redirect({
			to: "/editor/$projectId/artwork/$resourceId/detail/overview",
			params,
			search,
			replace: true,
		});
	},
});
