import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/$projectId/templates/$templateUid/form/$sectionId")({
	beforeLoad: ({ params }) => {
		if (
			[
				"general",
				"board",
			].includes(params.sectionId)
		)
			return;
		throw redirect({
			to: "/editor/$projectId/templates/$templateUid/form/$sectionId",
			params: {
				...params,
				sectionId: "general",
			},
			replace: true,
		});
	},
	component: () => {
		return null;
	},
});
