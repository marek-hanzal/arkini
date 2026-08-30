import { createFileRoute, redirect } from "@tanstack/react-router";

import { EditorProjectAppearanceSection } from "~/project-authoring/ui/EditorProjectAppearanceSection";
import { EditorProjectBoardSection } from "~/project-authoring/ui/EditorProjectBoardSection";
import { EditorProjectGeneralSection } from "~/project-authoring/ui/EditorProjectGeneralSection";
import { EditorProjectInventorySection } from "~/project-authoring/ui/EditorProjectInventorySection";
import {
	type EditorProjectSectionId,
	EditorProjectSectionIds,
} from "~/project-authoring/type/EditorProjectSections";
import { EditorProjectToolbarSection } from "~/project-authoring/ui/EditorProjectToolbarSection";

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
		if (EditorProjectSectionIds.some((section) => section === params.sectionId)) return;
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
		switch (sectionId as EditorProjectSectionId) {
			case "general":
				return <EditorProjectGeneralSection />;
			case "appearance":
				return <EditorProjectAppearanceSection initialAvatarIndex={avatar ?? 0} />;
			case "board":
				return <EditorProjectBoardSection />;
			case "toolbar":
				return <EditorProjectToolbarSection />;
			case "inventory":
				return <EditorProjectInventorySection />;
		}
	},
});
