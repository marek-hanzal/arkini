import { ItemDetailHeader } from "~/item-detail-frame/ui/ItemDetailHeader";
import { useCloseItemDetail } from "~/item-detail-frame/ui/useCloseItemDetail";
import { ItemQueue } from "~/item-detail/ui/ItemQueue";
import { ItemInfo } from "~/item-detail/ui/ItemInfo";
import { ItemLines } from "~/item-detail/ui/ItemLines";
import { ItemDetailTabs } from "~/item-detail/ui/ItemDetailTabs";
import { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import { useTranslator } from "~/translation/ui/useTranslator";
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
	const closeItemDetailFn = useCloseItemDetail();
	const translator = useTranslator();
	const status = controller.stale ? translator.textFn("Gone") : undefined;
	// Queue capacity is projected from authored lines, independently of rule visibility.
	const hasProduction = controller.detail?.queueSize !== undefined;
	const tab = hasProduction ? target.tab : "info";
	const navigation = hasProduction ? (
		<ItemDetailTabs
			active={tab}
			disabled={disabled}
			retained={controller.stale}
			target={target}
		/>
	) : undefined;
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
				className="min-h-0 flex-1 overflow-hidden [container-type:size] transition-opacity duration-300 data-[tab=info]:overflow-auto data-[tab=lines]:overflow-auto data-[ui-stale=true]:opacity-45"
				{...readDataUiFn({
					dataUi: "ItemDetailPanel",
					state: {
						stale: controller.stale,
					},
				})}
				data-tab={tab}
			>
				{tab === "info" && controller.detail !== undefined ? (
					<ItemInfo detail={controller.detail} />
				) : null}
				{tab === "queue" && controller.detail !== undefined ? (
					<ItemQueue
						key={`${target.kind}:${target.itemId}`}
						ownerItemId={target.kind === "runtime" ? target.itemId : undefined}
						queueSize={controller.detail.queueSize}
						disabled={disabled || controller.stale}
					/>
				) : null}
				{tab === "lines" && controller.detail !== undefined ? (
					<ItemLines
						key={`${target.kind}:${target.itemId}`}
						lines={controller.detail.lines}
						disabledLineIds={controller.detail.disabledLineIds}
						lineBlockingHints={controller.detail.lineBlockingHints}
						ownerItemId={target.kind === "runtime" ? target.itemId : undefined}
						disabled={disabled || controller.stale}
						makeDisabled={!controller.detail.canMake}
					/>
				) : null}
			</div>
		</div>
	);
};
