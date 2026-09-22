import { ProjectIntroductionDetail } from "~/project-authoring/ui/ProjectIntroductionDetail";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ProjectBoardDetail } from "~/project-authoring/ui/ProjectBoardDetail";
import { ProjectImagesDetail } from "~/project-authoring/ui/ProjectImagesDetail";
import { ProjectGeneralDetail } from "~/project-authoring/ui/ProjectGeneralDetail";
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
			case "introduction":
				return <ProjectIntroductionDetail project={project} />;
			case "general":
				return <ProjectGeneralDetail project={project} />;
			case "images":
				return <ProjectImagesDetail project={project} />;
			case "board":
				return <ProjectBoardDetail project={project} />;
		}
	},
});
