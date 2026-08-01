import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/$projectId/assets/$resourceId/detail/")({
	beforeLoad: ({ params, search }) => {
		throw redirect({
			to: "/editor/$projectId/assets/$resourceId/detail/overview",
			params,
			search,
			replace: true,
		});
	},
});
