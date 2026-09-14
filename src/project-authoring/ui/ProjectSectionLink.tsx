import { Tx } from "~/translation/ui/Tx";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { editorSectionLinkClassName } from "~/authoring-shell/ui/EditorSectionBar";
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
	<LinkButtonLink
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
		className={editorSectionLinkClassName}
	>
		<Tx label={section.label} />
	</LinkButtonLink>
);
