import { formatForDisplay } from "@tanstack/react-hotkeys";

import { useTranslator } from "~/translation/ui/useTranslator";
import { LinkButtonLink } from "~/ui/ui/LinkButton";
import { Tooltip } from "~/ui/ui/Tooltip";
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
}) => {
	const translator = useTranslator();
	const label = translator.textFn(section.label);
	const link = (
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
			{label}
		</LinkButtonLink>
	);
	if (destination !== "detail") return link;
	return (
		<Tooltip
			content={`${label} · ${formatForDisplay({
				key: section.shortcut,
			})}`}
			placement="bottom"
		>
			{link}
		</Tooltip>
	);
};
