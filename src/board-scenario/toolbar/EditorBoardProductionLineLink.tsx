import { ArrowUpRight } from "lucide-react";

import { readAuthoredItemLinesFn } from "~/production-line/fn/readAuthoredItemLinesFn";
import { useEditorProject } from "~/authoring-session/useEditorProject";
import type { ItemLineSummaryIdentityRenderProps } from "~/ui/item-detail/ItemLineSummary";
import { EditorProductionLineEditLink } from "~/item-authoring/ui/EditorProductionLineEditLink";

/** Links a shared gameplay line summary to that exact authored production line. */
export const EditorBoardProductionLineLink = ({
	children,
	disabled,
	itemId,
	lineId,
}: ItemLineSummaryIdentityRenderProps) => {
	const project = useEditorProject();
	const item = project.config.items[itemId];
	if (item === undefined || !readAuthoredItemLinesFn(item).some((line) => line.id === lineId))
		return children;
	return (
		<EditorProductionLineEditLink
			disabled={disabled}
			itemUid={item.uid}
			lineId={lineId}
			dataUi="EditorBoardProductionLineLink"
		>
			{children}
			<ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
		</EditorProductionLineEditLink>
	);
};
