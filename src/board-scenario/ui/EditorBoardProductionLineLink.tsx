import { ArrowUpRight } from "lucide-react";
import type { ComponentProps } from "react";

import { readAuthoredItemLinesFn } from "~/production-line/fn/readAuthoredItemLinesFn";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { ItemLineSummaryIdentityRenderer } from "~/item-line-detail/ui/ItemLineSummary";
import { LineEditLink } from "~/production-authoring/ui/LineEditLink";

/** Links a shared gameplay line summary to its exact authored production line. */
export const EditorBoardProductionLineLink = ({
	children,
	disabled,
	itemId,
	lineId,
}: ComponentProps<ItemLineSummaryIdentityRenderer>) => {
	const project = useEditorProject();
	const item = project.config.items[itemId];
	if (item === undefined || !readAuthoredItemLinesFn(item).some((line) => line.id === lineId))
		return children;
	return (
		<LineEditLink
			disabled={disabled}
			itemUid={item.uid}
			lineId={lineId}
			dataUi="EditorBoardProductionLineLink"
		>
			{children}
			<ArrowUpRight className="size-4 shrink-0 text-muted transition-colors group-hover:text-accent" />
		</LineEditLink>
	);
};
