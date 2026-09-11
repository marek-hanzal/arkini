import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/editor/$projectId/painter/$paintingId/")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/editor/$projectId/painter/$paintingId/canvas",
			params,
			replace: true,
		});
	},
});
