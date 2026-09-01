import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { ProjectFormSession } from "~/project-authoring/ui/ProjectFormSession";
import type { ProjectSectionId } from "~/project-authoring/type/ProjectSections";

interface EditorProjectFormSearch {
	readonly avatar?: number;
}

export const Route = createFileRoute("/editor/$projectId/project/form")({
	validateSearch: (search): EditorProjectFormSearch => {
		const avatar = typeof search.avatar === "number" ? search.avatar : Number.NaN;
		return Number.isInteger(avatar) && avatar >= 0
			? {
					avatar,
				}
			: {};
	},
	component: () => {
		const params = useParams({
			strict: false,
		});
		const sectionId = (
			typeof params.sectionId === "string" ? params.sectionId : "general"
		) as ProjectSectionId;
		return (
			<ProjectFormSession sectionId={sectionId}>
				<Outlet />
			</ProjectFormSession>
		);
	},
});
