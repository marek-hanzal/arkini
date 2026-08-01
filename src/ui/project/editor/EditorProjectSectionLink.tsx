import { ButtonLink } from "~/ui/button/Button";
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
			className: "border-accent bg-accent text-accent-contrast hover:bg-accent-hover",
		}}
		className="min-h-0 rounded-b-none border-transparent bg-transparent px-3 py-2 text-sm shadow-none"
	>
		{section.label}
	</ButtonLink>
);
