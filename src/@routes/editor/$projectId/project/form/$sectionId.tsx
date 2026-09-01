import { createFileRoute, redirect } from "@tanstack/react-router";

import { ProjectBoardSection } from "~/project-authoring/ui/ProjectBoardSection";
import { ProjectGeneralSection } from "~/project-authoring/ui/ProjectGeneralSection";
import { ProjectInventorySection } from "~/project-authoring/ui/ProjectInventorySection";
import { ProjectToolbarSection } from "~/project-authoring/ui/ProjectToolbarSection";
import { type ProjectSectionId, ProjectSectionIds } from "~/project-authoring/type/ProjectSections";

export const Route = createFileRoute("/editor/$projectId/project/form/$sectionId")({
	beforeLoad: ({ params }) => {
		if (ProjectSectionIds.some((section) => section === params.sectionId)) return;
		throw redirect({
			to: "/editor/$projectId/project/form/$sectionId",
			params: {
				...params,
				sectionId: "general",
			},
			search: true,
			replace: true,
		});
	},
	component: () => {
		const { sectionId } = Route.useParams();
		const { avatar } = Route.useSearch();
		switch (sectionId as ProjectSectionId) {
			case "general":
				return <ProjectGeneralSection initialAvatarIndex={avatar ?? 0} />;
			case "board":
				return <ProjectBoardSection />;
			case "toolbar":
				return <ProjectToolbarSection />;
			case "inventory":
				return <ProjectInventorySection />;
		}
	},
});
