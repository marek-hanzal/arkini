import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { ProjectDetail } from "~/project-authoring/ui/ProjectDetail";
import type { ProjectSectionId } from "~/project-authoring/type/ProjectSections";

export const Route = createFileRoute("/editor/$projectId/project/detail")({
	component: () => {
		const params = useParams({
			strict: false,
		});
		const sectionId = (
			typeof params.sectionId === "string" ? params.sectionId : "general"
		) as ProjectSectionId;
		return (
			<ProjectDetail sectionId={sectionId}>
				<Outlet />
			</ProjectDetail>
		);
	},
});
