import { createFileRoute, redirect } from "@tanstack/react-router";

import { ProjectAppearanceSection } from "~/project-authoring/ui/ProjectAppearanceSection";
import { ProjectBoardSection } from "~/project-authoring/ui/ProjectBoardSection";
import { ProjectGeneralSection } from "~/project-authoring/ui/ProjectGeneralSection";
import { ProjectInventorySection } from "~/project-authoring/ui/ProjectInventorySection";
import { type ProjectSectionId, ProjectSectionIds } from "~/project-authoring/type/ProjectSections";
import { ProjectToolbarSection } from "~/project-authoring/ui/ProjectToolbarSection";

interface EditorProjectSectionSearch {
	readonly avatar?: number;
}

export const Route = createFileRoute("/editor/$projectId/project/$sectionId")({
	validateSearch: (search): EditorProjectSectionSearch => {
		const avatar = typeof search.avatar === "number" ? search.avatar : Number.NaN;
		return Number.isInteger(avatar) && avatar >= 0
			? {
					avatar,
				}
			: {};
	},
	beforeLoad: ({ params }) => {
		if (ProjectSectionIds.some((section) => section === params.sectionId)) return;
		throw redirect({
			to: "/editor/$projectId/project/$sectionId",
			params: {
				...params,
				sectionId: "general",
			},
			replace: true,
		});
	},
	component: () => {
		const { sectionId } = Route.useParams();
		const { avatar } = Route.useSearch();
		switch (sectionId as ProjectSectionId) {
			case "general":
				return <ProjectGeneralSection />;
			case "appearance":
				return <ProjectAppearanceSection initialAvatarIndex={avatar ?? 0} />;
			case "board":
				return <ProjectBoardSection />;
			case "toolbar":
				return <ProjectToolbarSection />;
			case "inventory":
				return <ProjectInventorySection />;
		}
	},
});
