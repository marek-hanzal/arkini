import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/$projectId/mcp/")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/editor/$projectId/mcp/$sectionId",
			params: {
				...params,
				sectionId: "server",
			},
			replace: true,
		});
	},
});
