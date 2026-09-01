import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/$projectId/project/form/")({
	beforeLoad: ({ params, search }) => {
		throw redirect({
			to: "/editor/$projectId/project/form/$sectionId",
			params: {
				...params,
				sectionId: "general",
			},
			search,
			replace: true,
		});
	},
});
