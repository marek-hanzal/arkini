import { ItemInfo } from "~/item-detail/ui/ItemInfo";
import { ItemLines } from "~/item-detail/ui/ItemLines";
import type { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import type { ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";

interface ItemDetailDefaultProps {
	readonly detail: useItemDetailSceneController.Detail;
	readonly disabled: boolean;
	readonly stale: boolean;
	readonly target: ItemDetailTarget;
}

/** Item facts precede production; the scene initially scrolls to the lines. */
export const ItemDetailDefault = ({ detail, disabled, stale, target }: ItemDetailDefaultProps) => (
	<div data-ui="ItemDetailDefault">
		<ItemInfo
			detail={detail}
			stale={stale}
		/>
		{stale ? null : (
			<ItemLines
				key={`${target.kind}:${target.kind === "runtime" ? target.itemId : target.itemUid}`}
				lines={detail.lines}
				disabledLineUids={detail.disabledLineUids}
				lineBlockingHints={detail.lineBlockingHints}
				materialReadyLineUids={detail.materialReadyLineUids}
				playReadyLineUids={detail.playReadyLineUids}
				ownerItemId={target.kind === "runtime" ? target.itemId : undefined}
				disabled={disabled}
				makeDisabled={!detail.canMake}
			/>
		)}
	</div>
);
