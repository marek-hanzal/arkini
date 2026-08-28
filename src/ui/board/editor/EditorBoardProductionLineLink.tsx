import { ArrowUpRight } from "lucide-react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { readEditorItemLinesFx } from "~/bridge/item/editor/readEditorItemLinesFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { ItemLineSummaryIdentityRenderProps } from "~/ui/item-detail/ItemLineSummary";
import { EditorProductionLineEditLink } from "~/ui/item/editor/EditorProductionLineEditLink";

/** Links a shared gameplay line summary to that exact authored production line. */
export const EditorBoardProductionLineLink = ({
	children,
	disabled,
	itemId,
	lineId,
}: ItemLineSummaryIdentityRenderProps) => {
	const project = useEditorProject();
	const item = project.config.items[itemId];
	if (
		item === undefined ||
		!RendererRuntime.runSync(readEditorItemLinesFx(item)).some((line) => line.id === lineId)
	)
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
