import { ButtonLink } from "~/ui/ui/Button";
import { editorSectionTabClassName } from "~/authoring-shell/ui/EditorSectionTabs";
import type { ProjectSectionDescriptor } from "~/project-authoring/type/ProjectSections";

export const ProjectSectionLink = ({
	destination,
	projectId,
	section,
}: {
	readonly destination: "detail" | "form";
	readonly projectId: string;
	readonly section: ProjectSectionDescriptor;
}) => (
	<ButtonLink
		to={
			destination === "detail"
				? "/editor/$projectId/project/detail/$sectionId"
				: "/editor/$projectId/project/form/$sectionId"
		}
		params={{
			projectId,
			sectionId: section.id,
		}}
		activeOptions={{
			exact: true,
		}}
		activeProps={{
			"data-ui-selected": true,
		}}
		className={editorSectionTabClassName}
	>
		{section.label}
	</ButtonLink>
);
