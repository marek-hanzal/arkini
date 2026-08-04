import { ButtonLink } from "~/ui/button/Button";
import {
	editorSectionTabActiveClassName,
	editorSectionTabClassName,
} from "~/ui/editor/EditorSectionTabs";
import type { EditorProjectSectionDescriptor } from "~/ui/project/editor/EditorProjectSections";

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
			className: editorSectionTabActiveClassName,
		}}
		className={editorSectionTabClassName}
	>
		{section.label}
	</ButtonLink>
);
