import { useSectionShortcuts } from "~/ui/ui/useSectionShortcuts";
import { useNavigate } from "@tanstack/react-router";

import { ProjectSections } from "~/project-authoring/type/ProjectSections";

export namespace useProjectSectionShortcuts {
	export interface Props {
		readonly projectId: string;
		readonly destination?: "detail" | "form";
	}
}

/** Owns Project section routing in detail and the retained form session; Edit keeps E. */
export const useProjectSectionShortcuts = ({
	projectId,
	destination = "detail",
}: useProjectSectionShortcuts.Props) => {
	const navigateFn = useNavigate();
	useSectionShortcuts({
		options: ProjectSections,
		onSelectFn: (section) => {
			void navigateFn({
				to:
					destination === "detail"
						? "/editor/$projectId/project/detail/$sectionId"
						: "/editor/$projectId/project/form/$sectionId",
				params: {
					projectId,
					sectionId: section.id,
				},
			});
		},
	});
};
