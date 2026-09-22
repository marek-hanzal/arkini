import { ProjectIntroductionSection } from "~/project-authoring/ui/ProjectIntroductionSection";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { ProjectBoardSection } from "~/project-authoring/ui/ProjectBoardSection";
import { ProjectImagesSection } from "~/project-authoring/ui/ProjectImagesSection";
import { ProjectGeneralSection } from "~/project-authoring/ui/ProjectGeneralSection";
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
			case "introduction":
				return <ProjectIntroductionSection />;
			case "general":
				return <ProjectGeneralSection />;
			case "images":
				return <ProjectImagesSection initialAvatarIndex={avatar ?? 0} />;
			case "board":
				return <ProjectBoardSection />;
		}
	},
});
