import type { FC } from "react";
import { readActivationInputViewFillableQuantity } from "~/v0/board/logic/readActivationInputViewFillableQuantity";
import { readActivationInputViewLabel } from "~/v0/board/logic/readActivationInputViewLabel";
import { readActivationInputViewReady } from "~/v0/board/logic/readActivationInputViewReady";
import type { ActivationInputView } from "~/v0/board/view/ActivationInputViewSchema";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { cn } from "~/v0/ui/cn";
import { DetailCard, DetailMutedPill } from "~/v1/item-detail/ui/DetailCard";

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
			<div className="grid max-h-72 gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
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
							className="flex min-w-0 items-center gap-2 rounded-sm border border-ak-border/70 bg-ak-surface px-2.5 py-2 text-sm"
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
									"shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.14em]",
									ready
										? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
										: "border-rose-400/30 bg-rose-400/10 text-rose-200",
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
