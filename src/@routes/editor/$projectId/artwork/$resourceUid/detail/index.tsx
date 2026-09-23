import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/$projectId/artwork/$resourceUid/detail/")({
	beforeLoad: ({ params, search }) => {
		throw redirect({
			to: "/editor/$projectId/artwork/$resourceUid/detail/overview",
			params,
			search,
			replace: true,
		});
	},
});
