import { ItemDetailHeader } from "~/item-detail-frame/ui/ItemDetailHeader";
import { useCloseItemDetail } from "~/item-detail-frame/ui/useCloseItemDetail";
import { ItemInfo } from "~/item-detail/ui/ItemInfo";
import { ItemLines } from "~/item-detail/ui/ItemLines";
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
	const fullInterface = controller.detail?.ui === "default";
	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemDetailScene"
		>
			{controller.detail !== undefined ? (
				<ItemDetailHeader
					disabled={disabled}
					identity={controller.detail}
					status={status}
				/>
			) : (
				<header className="flex items-center justify-between border-b border-line pb-3">
					<div>
						<h2 className="text-lg font-semibold">
							<Tx label="Item unavailable" />
						</h2>
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
				className="min-h-0 flex-1 overflow-auto [container-type:size] transition-opacity duration-300 data-[ui-stale=true]:opacity-45"
				{...readDataUiFn({
					dataUi: "ItemDetailPanel",
					state: {
						stale: controller.stale,
					},
				})}
			>
				{fullInterface && controller.detail !== undefined ? (
					<ItemLines
						key={`${target.kind}:${target.kind === "runtime" ? target.itemId : target.itemUid}`}
						lines={controller.detail.lines}
						disabledLineIds={controller.detail.disabledLineIds}
						lineBlockingHints={controller.detail.lineBlockingHints}
						ownerItemId={target.kind === "runtime" ? target.itemId : undefined}
						disabled={disabled || controller.stale}
						makeDisabled={!controller.detail.canMake}
					/>
				) : null}
				{controller.detail !== undefined ? (
					<div className="pb-[50cqh]">
						<ItemInfo detail={controller.detail} />
					</div>
				) : null}
			</div>
		</div>
	);
};
