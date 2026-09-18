import { Tx } from "~/translation/ui/Tx";
import { ItemDetailHeader } from "~/item-detail-frame/ui/ItemDetailHeader";
import { useCloseItemDetail } from "~/item-detail-frame/ui/useCloseItemDetail";
import { ItemDetailContent } from "~/item-detail/ui/ItemDetailContent";
import { ItemDetailTabs } from "~/item-detail/ui/ItemDetailTabs";
import { useDefinitionItemDetailSceneController } from "~/item-detail/ui/useDefinitionItemDetailSceneController";

interface DefinitionItemDetailSceneProps extends useDefinitionItemDetailSceneController.Props {
	readonly disabled: boolean;
}

export const DefinitionItemDetailScene = ({ disabled, target }: DefinitionItemDetailSceneProps) => {
	const controller = useDefinitionItemDetailSceneController({
		target,
	});
	const closeItemDetailFn = useCloseItemDetail();
	if (controller.definition.kind === "unavailable") {
		return (
			<div
				className="flex min-h-0 flex-1 flex-col"
				data-ui="ItemDetailContentScene"
				data-stale="true"
			>
				<header className="flex items-center justify-between border-b border-line pb-3">
					<h2 className="text-lg font-semibold">
						<Tx label="Item unavailable" />
					</h2>
					<button
						type="button"
						className="grid size-9 cursor-pointer place-items-center border border-line bg-surface text-lg text-muted"
						onClick={() => closeItemDetailFn()}
					>
						×
					</button>
				</header>
				<ItemDetailTabs
					active={target.tab}
					disabled={disabled}
					retained
					target={target}
				/>
			</div>
		);
	}

	return (
		<div
			className="flex min-h-0 flex-1 flex-col"
			data-ui="ItemDetailContentScene"
			data-stale="false"
		>
			<ItemDetailHeader
				disabled={disabled}
				identity={{
					title: controller.definition.title,
					sourceUrl: controller.definition.sourceUrl,
					compositeUrl: controller.definition.compositeUrl,
				}}
				navigation={
					<ItemDetailTabs
						active={target.tab}
						disabled={disabled}
						target={target}
					/>
				}
				stale={false}
			/>
			<div className="flex min-h-0 flex-1 overflow-hidden pt-4">
				<ItemDetailContent
					kind="definition"
					definition={controller.definition}
					disabled={disabled}
					target={target}
				/>
			</div>
		</div>
	);
};
