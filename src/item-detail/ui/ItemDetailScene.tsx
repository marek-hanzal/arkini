import { ItemDetailHeader } from "~/item-detail-frame/ui/ItemDetailHeader";
import { useCloseItemDetail } from "~/item-detail-frame/ui/useCloseItemDetail";
import { ItemQueue } from "~/item-detail/ui/ItemQueue";
import { ItemInfo } from "~/item-detail/ui/ItemInfo";
import { ItemLines } from "~/item-detail/ui/ItemLines";
import { ItemDetailTabs } from "~/item-detail/ui/ItemDetailTabs";
import { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Tx } from "~/translation/ui/Tx";

interface ItemDetailSceneProps extends useItemDetailSceneController.Props {
	readonly disabled: boolean;
}

/** Composes the shared item frame and its player-facing sections. */
export const ItemDetailScene = ({ disabled, target }: ItemDetailSceneProps) => {
	const controller = useItemDetailSceneController({
		target,
	});
	const closeItemDetailFn = useCloseItemDetail();
	const translator = useTranslator();
	const status = !controller.stale
		? undefined
		: controller.removalReason === "depleted"
			? translator.textFn("Depleted")
			: controller.removalReason === "expired"
				? translator.textFn("Expired")
				: translator.textFn("No longer here");
	const navigation = (
		<ItemDetailTabs
			active={target.tab}
			disabled={disabled}
			retained={controller.stale}
			target={target}
		/>
	);
	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemDetailScene"
		>
			{controller.detail !== undefined ? (
				<ItemDetailHeader
					disabled={disabled}
					identity={controller.detail}
					navigation={navigation}
					status={status}
				/>
			) : (
				<header className="flex items-center justify-between border-b border-line pb-3">
					<div>
						<h2 className="text-lg font-semibold">
							<Tx label="Item unavailable" />
						</h2>
						{navigation}
					</div>
					<button
						type="button"
						disabled={disabled}
						className="grid size-14 cursor-pointer place-items-center text-foreground hover:text-accent"
						onClick={() => closeItemDetailFn()}
					>
						×
					</button>
				</header>
			)}
			<div
				className="min-h-0 flex-1 overflow-auto [container-type:size] data-[tab=queue]:overflow-hidden"
				data-ui="ItemDetailPanel"
				data-tab={target.tab}
			>
				{target.tab === "info" && controller.detail !== undefined ? (
					<ItemInfo detail={controller.detail} />
				) : null}
				{target.tab === "queue" && controller.detail !== undefined ? (
					<ItemQueue
						key={`${target.kind}:${target.itemId}`}
						ownerItemId={target.kind === "runtime" ? target.itemId : undefined}
						queueSize={controller.detail.queueSize}
						disabled={disabled || controller.stale}
					/>
				) : null}
				{target.tab === "lines" && controller.detail !== undefined ? (
					<ItemLines
						key={`${target.kind}:${target.itemId}`}
						lines={controller.detail.lines}
						ownerItemId={target.kind === "runtime" ? target.itemId : undefined}
						disabled={disabled || controller.stale}
						makeDisabled={!controller.detail.canMake}
					/>
				) : null}
			</div>
		</div>
	);
};
