import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/$projectId/project/detail/")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/editor/$projectId/project/detail/$sectionId",
			params: {
				...params,
				sectionId: "general",
			},
			replace: true,
		});
	},
});
