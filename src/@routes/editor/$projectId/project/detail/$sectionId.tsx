import { createFileRoute, redirect } from "@tanstack/react-router";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ProjectBoardDetail } from "~/project-authoring/ui/ProjectBoardDetail";
import { ProjectArtworkDetail } from "~/project-authoring/ui/ProjectArtworkDetail";
import { ProjectGeneralDetail } from "~/project-authoring/ui/ProjectGeneralDetail";
import { ProjectInventoryDetail } from "~/project-authoring/ui/ProjectInventoryDetail";
import { ProjectToolbarDetail } from "~/project-authoring/ui/ProjectToolbarDetail";
import { type ProjectSectionId, ProjectSectionIds } from "~/project-authoring/type/ProjectSections";

export const Route = createFileRoute("/editor/$projectId/project/detail/$sectionId")({
	beforeLoad: ({ params }) => {
		if (ProjectSectionIds.some((section) => section === params.sectionId)) return;
		throw redirect({
			to: "/editor/$projectId/project/detail/$sectionId",
			params: {
				...params,
				sectionId: "general",
			},
			replace: true,
		});
	},
	component: () => {
		const { sectionId } = Route.useParams();
		const project = useEditorProject();
		switch (sectionId as ProjectSectionId) {
			case "general":
				return <ProjectGeneralDetail project={project} />;
			case "artwork":
				return <ProjectArtworkDetail project={project} />;
			case "board":
				return <ProjectBoardDetail project={project} />;
			case "toolbar":
				return <ProjectToolbarDetail project={project} />;
			case "inventory":
				return <ProjectInventoryDetail project={project} />;
		}
	},
});
