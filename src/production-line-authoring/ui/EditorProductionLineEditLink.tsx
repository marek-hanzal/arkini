import type { PropsWithChildren } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ButtonLink } from "~/ui/ui/Button";

/** Opens the production form with one authored line selected. */
export const EditorProductionLineEditLink = ({
	children,
	dataUi = "EditorProductionLineEditLink",
	disabled = false,
	itemUid,
	lineId,
}: PropsWithChildren<{
	readonly dataUi?: string;
	readonly disabled?: boolean;
	readonly itemUid: string;
	readonly lineId: string;
}>) => {
	const project = useEditorProject();
	return (
		<ButtonLink
			disabled={disabled}
			to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
			params={{
				projectId: project.projectId,
				itemUid,
				sectionId: "production",
			}}
			search={{
				lineId,
			}}
			className="group inline-flex min-h-0 w-fit max-w-full flex-none items-center justify-start rounded-none border-0 bg-transparent p-0 text-left text-[inherit] font-[inherit] decoration-accent/55 underline-offset-4 shadow-none hover:border-transparent hover:bg-transparent hover:text-accent hover:underline active:bg-transparent"
			data-ui={dataUi}
		>
			<span className="inline-flex max-w-full min-w-0 items-center gap-1.5">{children}</span>
		</ButtonLink>
	);
};
