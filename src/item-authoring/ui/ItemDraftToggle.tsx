import { Square, SquareCheck } from "lucide-react";
import { Tx } from "~/translation/ui/Tx";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

import { readDraftFn } from "~/item-authoring/fn/readDraftFn";
import { useItemDraftController } from "~/item-authoring/ui/useItemDraftController";
import { LinkButton } from "~/ui/ui/LinkButton";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

interface ItemDraftToggleProps extends useItemDraftController.Props {
	readonly item: ItemSchema.Type;
}

/** Presents and persists the current Editor-only draft status of one saved item. */
export const ItemDraftToggle = ({ item }: ItemDraftToggleProps) => {
	const controller = useItemDraftController({
		item,
	});
	const draft = readDraftFn(item);
	const DraftIcon = draft ? SquareCheck : Square;
	return (
		<div className="grid justify-items-end gap-1">
			<LinkButton
				className="inline-flex h-9 items-center justify-center gap-1.5 text-sm data-[ui-active=true]:text-foreground"
				cursorIntent={controller.pending ? "wait" : "pointer"}
				disabled={controller.pending}
				onClick={() => void controller.toggleFn()}
				{...readDataUiFn({
					dataUi: "EditorItemDraftToggle",
					state: {
						active: draft,
						pending: controller.pending,
					},
				})}
			>
				<Tx label="Draft" />
				<DraftIcon className="size-4 shrink-0" />
			</LinkButton>
			{controller.error === undefined ? null : (
				<p
					className="max-w-80 text-right text-xs text-danger"
					data-ui="EditorItemDraftError"
				>
					{String(controller.error)}
				</p>
			)}
		</div>
	);
};
