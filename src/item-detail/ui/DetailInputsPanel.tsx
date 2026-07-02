import type { FC } from "react";
import { readActivationInputViewFillableQuantity } from "~/board/logic/readActivationInputViewFillableQuantity";
import { readActivationInputViewLabel } from "~/board/logic/readActivationInputViewLabel";
import { readActivationInputViewReady } from "~/board/logic/readActivationInputViewReady";
import type { ActivationInputView } from "~/board/view/ActivationInputViewSchema";
import { ItemInlineAsset } from "~/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import { cn } from "~/ui/cn";
import { DetailCard, DetailMutedPill } from "~/item-detail/ui/DetailCard";

export namespace DetailInputsPanel {
	export interface Props {
		hideSatisfied?: boolean;
		inputs?: readonly ActivationInputView[];
		items: ItemCatalogView;
		title: string;
	}
}

export const DetailInputsPanel: FC<DetailInputsPanel.Props> = ({
	hideSatisfied = true,
	inputs = [],
	items,
	title,
}) => {
	const rows = inputs
		.map((input) => ({
			input,
			ready: readActivationInputViewReady(input),
		}))
		.filter((row) => !hideSatisfied || !row.ready);

	if (rows.length === 0) return null;

	return (
		<DetailCard
			title={title}
			action={<DetailMutedPill>{rows.length}</DetailMutedPill>}
		>
			<div className="grid gap-2">
				{rows.map(({ input, ready }) => {
					const item = items[input.itemId];
					const fillableQuantity = readActivationInputViewFillableQuantity(input);
					const meta = [
						readActivationInputViewLabel(input),
						input.capacity > input.quantity ? `cap ${input.capacity}` : undefined,
						fillableQuantity > 0 ? `+${fillableQuantity} available` : undefined,
						input.consume ? "consumed" : "kept",
					]
						.filter(Boolean)
						.join(" · ");

					return (
						<div
							key={input.itemId}
							className="flex min-w-0 items-center gap-2 rounded-sm bg-ak-surface/80 px-2.5 py-2 text-sm"
						>
							<ItemInlineAsset
								item={item}
								className="h-9 w-9"
							/>
							<div className="min-w-0 flex-1">
								<p className="break-words font-black text-ak-text">
									{item?.name ?? input.itemId}
								</p>
								<p className="mt-0.5 break-words text-xs leading-5 text-ak-text-muted">
									{meta}
								</p>
							</div>
							<span
								className={cn(
									"shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.14em] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]",
									ready
										? "border-emerald-300/55 bg-emerald-400/18 text-emerald-100"
										: "border-rose-300/55 bg-rose-400/18 text-rose-100",
								)}
							>
								{ready ? "Ready" : "Missing"}
							</span>
						</div>
					);
				})}
			</div>
		</DetailCard>
	);
};
