import { ButtonLink } from "~/ui/ui/Button";
import { editorSectionTabClassName } from "~/authoring-shell/ui/EditorSectionTabs";
import type { ProjectSectionDescriptor } from "~/project-authoring/type/ProjectSections";

export const ProjectSectionLink = ({
	projectId,
	section,
}: {
	readonly projectId: string;
	readonly section: ProjectSectionDescriptor;
}) => (
	<ButtonLink
		to="/editor/$projectId/project/$sectionId"
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
