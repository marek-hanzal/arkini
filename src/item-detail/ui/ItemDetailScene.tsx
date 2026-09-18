import { ItemDetailHeader } from "~/item-detail-frame/ui/ItemDetailHeader";
import { useCloseItemDetail } from "~/item-detail-frame/ui/useCloseItemDetail";
import { ItemDetailTabs } from "~/item-detail/ui/ItemDetailTabs";
import { useItemDetailSceneController } from "~/item-detail/ui/useItemDetailSceneController";
import { Tx } from "~/translation/ui/Tx";

interface ItemDetailSceneProps extends useItemDetailSceneController.Props {
	readonly disabled: boolean;
}

/** The detail shell deliberately has no capability panels during the UI rebuild. */
export const ItemDetailScene = ({ disabled, target }: ItemDetailSceneProps) => {
	const controller = useItemDetailSceneController({
		target,
	});
	const closeItemDetailFn = useCloseItemDetail();
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
			{controller.identity !== undefined ? (
				<ItemDetailHeader
					disabled={disabled}
					identity={controller.identity}
					navigation={navigation}
					stale={controller.stale}
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
				className="min-h-0 flex-1"
				data-ui="ItemDetailPanel"
				data-tab={target.tab}
			/>
		</div>
	);
};
