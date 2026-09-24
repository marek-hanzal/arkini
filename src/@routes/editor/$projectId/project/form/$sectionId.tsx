import { match } from "ts-pattern";
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
		return match(sectionId as ProjectSectionId)
			.with("introduction", () => {
				return <ProjectIntroductionSection />;
			})
			.with("general", () => {
				return <ProjectGeneralSection />;
			})
			.with("images", () => {
				return <ProjectImagesSection initialAvatarIndex={avatar} />;
			})
			.with("board", () => {
				return <ProjectBoardSection />;
			})
			.exhaustive();
	},
});
