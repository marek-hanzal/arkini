import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { ButtonLink } from "~/ui/button/Button";

/** Opens the production form with one authored line selected. */
export const EditorProductionLineEditLink = ({
	children,
	className,
	dataUi = "EditorProductionLineEditLink",
	disabled = false,
	itemUid,
	lineId,
}: PropsWithChildren<{
	readonly className?: string;
	readonly dataUi?: string;
	readonly disabled?: boolean;
	readonly itemUid: string;
	readonly lineId: string;
}>) => {
	const project = useEditorProject();
	return (
		<ButtonLink
			aria-disabled={disabled}
			to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
			params={{
				projectId: project.projectId,
				itemUid,
				sectionId: "production",
			}}
			search={{
				lineId,
			}}
			className={className}
			data-ui={dataUi}
		>
			{children}
		</ButtonLink>
	);
};
