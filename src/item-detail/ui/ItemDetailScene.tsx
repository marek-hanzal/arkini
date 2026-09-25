import { ItemInfo } from "~/item-detail/ui/ItemInfo";
import { ItemLines } from "~/item-detail/ui/ItemLines";
import { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import { Tx } from "~/translation/ui/Tx";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

interface ItemDetailSceneProps extends useItemDetailSceneController.Props {
	readonly disabled: boolean;
}

/** Composes the shared item frame and its player-facing sections. */
export const ItemDetailScene = ({ disabled, target }: ItemDetailSceneProps) => {
	const controller = useItemDetailSceneController({
		target,
	});
	const fullInterface = controller.detail?.ui === "default";
	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemDetailScene"
		>
			<div
				className="min-h-0 flex-1 overflow-auto [container-type:size] transition-opacity duration-300 data-[ui-interface=default]:pt-14 data-[ui-stale=true]:opacity-45"
				{...readDataUiFn({
					dataUi: "ItemDetailPanel",
					state: {
						interface: controller.detail?.ui,
						stale: controller.stale,
					},
				})}
			>
				{fullInterface && controller.detail !== undefined ? (
					<ItemLines
						key={`${target.kind}:${target.kind === "runtime" ? target.itemId : target.itemUid}`}
						lines={controller.detail.lines}
						disabledLineUids={controller.detail.disabledLineUids}
						lineBlockingHints={controller.detail.lineBlockingHints}
						materialReadyLineUids={controller.detail.materialReadyLineUids}
						ownerItemId={target.kind === "runtime" ? target.itemId : undefined}
						disabled={disabled || controller.stale}
						makeDisabled={!controller.detail.canMake}
					/>
				) : null}
				{controller.detail !== undefined ? (
					<div
						className="data-[ui-interface=simple]:grid data-[ui-interface=simple]:min-h-full data-[ui-interface=simple]:items-center"
						{...readDataUiFn({
							dataUi: "ItemInfoContainer",
							state: {
								interface: controller.detail.ui,
							},
						})}
					>
						<ItemInfo
							detail={controller.detail}
							stale={controller.stale}
						/>
					</div>
				) : (
					<h2 className="p-6 text-2xl font-semibold">
						<Tx label="Item unavailable" />
					</h2>
				)}
			</div>
		</div>
	);
};
