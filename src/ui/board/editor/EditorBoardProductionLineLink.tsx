import { ArrowUpRight } from "lucide-react";

import { useEditorProject } from "~/ui/editor/useEditorProject";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { readAuthoredItemLinesFx } from "~/engine/line/read/readAuthoredItemLinesFx";
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
		!RendererRuntime.runSync(readAuthoredItemLinesFx(item)).some((line) => line.id === lineId)
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
