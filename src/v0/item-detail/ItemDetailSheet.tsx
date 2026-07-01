import type { FC, ReactNode } from "react";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { useItemDetailControls } from "~/v0/item-detail/control/useItemDetailControls";
import { DetailCraftPanel } from "~/v0/item-detail/ui/DetailCraftPanel";
import { DetailDropsPanel } from "~/v0/item-detail/ui/DetailDropsPanel";
import { DetailGeneratedEffectsPanel } from "~/v0/item-detail/ui/DetailGeneratedEffectsPanel";
import { DetailHeroCard } from "~/v0/item-detail/ui/DetailHeroCard";
import { DetailInputsPanel } from "~/v0/item-detail/ui/DetailInputsPanel";
import { DetailProducerLinesPanel } from "~/v0/item-detail/ui/DetailProducerLinesPanel";
import { DetailSeparator } from "~/v0/item-detail/ui/DetailCard";
import { SheetHeader } from "~/v0/play/sheet/SheetHeader";

export namespace ItemDetailSheet {
	export interface Props {
		actionErrorMessage?: string;
		boardItem?: BoardViewItem;
		canSetDefaultLines: boolean;
		isPending: boolean;
		items: ItemCatalogView;
		onClaimCraft(): void;
		onClose(): void;
		onSetDefaultProductLine(productId: string): void;
		onStartCraft(): void;
		onStartProductLine(productId: string): void;
		onWithdrawCraftInput(itemId: string): void;
		onWithdrawProductLineInput(productId: string, itemId: string): void;
	}
}

const interleaveSections = (sections: readonly ReactNode[]) =>
	sections.flatMap((section, index) =>
		index === 0
			? [
					section,
				]
			: [
					<DetailSeparator
						key={`detail-section-separator:${index}`}
						className="my-4"
					/>,
					section,
				],
	);

export const ItemDetailSheet: FC<ItemDetailSheet.Props> = ({
	actionErrorMessage,
	boardItem,
	canSetDefaultLines,
	isPending,
	items,
	onClaimCraft,
	onClose,
	onSetDefaultProductLine,
	onStartCraft,
	onStartProductLine,
	onWithdrawCraftInput,
	onWithdrawProductLineInput,
}) => {
	const item = boardItem ? items[boardItem.itemId] : undefined;
	const activation = boardItem?.activation;
	const { craftControl, producerLineModels } = useItemDetailControls({
		boardItem,
		canSetDefaultLines,
		isPending,
		onClaimCraft,
		onSetDefaultProductLine,
		onStartCraft,
		onStartProductLine,
		onWithdrawCraftInput,
		onWithdrawProductLineInput,
	});

	if (!boardItem || !item) {
		return (
			<section
				data-ui="tile detail"
				className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 w-full flex-col overflow-hidden bg-ak-surface"
			>
				<SheetHeader
					title="Nothing selected"
					onClose={onClose}
				/>
				<div className="mx-auto min-h-0 w-full max-w-[540px] flex-1 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
					<p className="text-sm text-ak-text-muted">Select a board item first.</p>
				</div>
			</section>
		);
	}

	const sections = [
		<DetailHeroCard
			key="hero"
			assetProgress={boardItem.craft?.inputProgress}
			item={item}
		/>,
		<DetailGeneratedEffectsPanel
			key="generated-effects"
			effects={item.generatedEffects}
		/>,
		boardItem.craft && craftControl ? (
			<DetailCraftPanel
				key="craft"
				control={craftControl}
				craft={boardItem.craft}
				items={items}
			/>
		) : null,
		activation?.kind === "stash" ? (
			<DetailDropsPanel
				key="drops"
				drops={activation.drops}
				items={items}
			/>
		) : null,
		activation?.inputs.length ? (
			<DetailInputsPanel
				key="shared-inputs"
				inputs={activation.inputs}
				items={items}
				title={activation.kind === "stash" ? "Needed to open" : "Shared inputs"}
			/>
		) : null,
		producerLineModels.length ? (
			<DetailProducerLinesPanel
				key="producer-lines"
				items={items}
				lines={producerLineModels}
			/>
		) : null,
	].filter(Boolean) as ReactNode[];

	return (
		<section
			data-ui="tile detail"
			className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 w-full flex-col overflow-hidden bg-ak-surface"
		>
			<SheetHeader
				title={item.name}
				onClose={onClose}
			/>
			<div className="mx-auto min-h-0 w-full max-w-[540px] flex-1 overflow-y-auto overscroll-contain px-4 py-4 text-sm text-ak-text [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
				{actionErrorMessage ? (
					<div className="rounded-sm border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-sm font-bold text-rose-100">
						{actionErrorMessage}
					</div>
				) : null}
				{actionErrorMessage && sections.length > 0 ? (
					<DetailSeparator className="my-4" />
				) : null}
				{interleaveSections(sections)}
			</div>
		</section>
	);
};
