import { ButtonLink } from "~/ui/ui/Button";
import { editorSectionTabClassName } from "~/authoring-shell/ui/EditorSectionTabs";
import type { EditorProjectSectionDescriptor } from "~/project-authoring/type/EditorProjectSections";

export const EditorProjectSectionLink = ({
	projectId,
	section,
}: {
	readonly projectId: string;
	readonly section: EditorProjectSectionDescriptor;
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
