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

/** Full production controls followed by the item's facts. */
export const ItemDetailDefault = ({ detail, disabled, stale, target }: ItemDetailDefaultProps) => (
	<div data-ui="ItemDetailDefault">
		<ItemLines
			key={`${target.kind}:${target.kind === "runtime" ? target.itemId : target.itemUid}`}
			lines={detail.lines}
			disabledLineUids={detail.disabledLineUids}
			lineBlockingHints={detail.lineBlockingHints}
			materialReadyLineUids={detail.materialReadyLineUids}
			playReadyLineUids={detail.playReadyLineUids}
			ownerItemId={target.kind === "runtime" ? target.itemId : undefined}
			disabled={disabled || stale}
			makeDisabled={!detail.canMake}
		/>
		<ItemInfo
			detail={detail}
			stale={stale}
		/>
	</div>
);
