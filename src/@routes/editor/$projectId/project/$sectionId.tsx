import { createFileRoute, redirect } from "@tanstack/react-router";

import { ProjectSectionIds } from "~/project-authoring/type/ProjectSections";

export const Route = createFileRoute("/editor/$projectId/project/$sectionId")({
	beforeLoad: ({ params }) => {
		const sectionId = ProjectSectionIds.some((section) => section === params.sectionId)
			? params.sectionId
			: "general";
		throw redirect({
			to: "/editor/$projectId/project/detail/$sectionId",
			params: {
				projectId: params.projectId,
				sectionId,
			},
			replace: true,
		});
	},
});
