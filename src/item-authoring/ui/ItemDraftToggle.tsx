import { Tx } from "~/translation/ui/Tx";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";

import { readDraftFn } from "~/item-authoring/fn/readDraftFn";
import { useItemDraftController } from "~/item-authoring/ui/useItemDraftController";
import { Button, PrimaryButton } from "~/ui/ui/Button";
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
	const DraftButton = draft ? PrimaryButton : Button;
	return (
		<div className="grid justify-items-end gap-1">
			<DraftButton
				className="h-10 min-h-10 px-3 py-2 text-sm"
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
			</DraftButton>
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
