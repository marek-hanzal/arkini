import type { FC, ReactNode } from "react";
import { readActivationInputViewFillableQuantity } from "~/v0/board/logic/readActivationInputViewFillableQuantity";
import { readActivationInputViewLabel } from "~/v0/board/logic/readActivationInputViewLabel";
import { readActivationInputViewReady } from "~/v0/board/logic/readActivationInputViewReady";
import type { ActivationInputView } from "~/v0/board/view/ActivationInputViewSchema";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { UiSection } from "~/v0/ui/UiSection";

export namespace ItemActivationInputsCard {
	export interface Props {
		hideSatisfied?: boolean;
		inputs?: readonly ActivationInputView[];
		items: ItemCatalogView;
		title: string;
	}
}

interface DetailRow {
	key: string;
	label: string;
	meta?: string;
	satisfied: boolean;
	tone: "success" | "danger";
	asset: ReactNode;
}

const readInputRow = (input: ActivationInputView, items: ItemCatalogView): DetailRow => {
	const capacityLabel = input.capacity > input.quantity ? `cap ${input.capacity}` : undefined;
	const fillableQuantity = readActivationInputViewFillableQuantity(input);
	const availableLabel = fillableQuantity > 0 ? `+${fillableQuantity} available` : undefined;
	const consumeLabel = input.consume ? "consumed at start" : "returned or kept";
	const meta = [
		readActivationInputViewLabel(input),
		capacityLabel,
		availableLabel,
		consumeLabel,
	]
		.filter(Boolean)
		.join(" · ");

	return {
		key: `input:${input.itemId}`,
		label: items[input.itemId]?.name ?? input.itemId,
		meta,
		satisfied: readActivationInputViewReady(input),
		tone: readActivationInputViewReady(input) ? "success" : "danger",
		asset: (
			<ItemInlineAsset
				item={items[input.itemId]}
				className="h-9 w-9"
			/>
		),
	};
};

export const ItemActivationInputsCard: FC<ItemActivationInputsCard.Props> = ({
	hideSatisfied = true,
	inputs = [],
	items,
	title,
}) => {
	const allRows = inputs.map((input) => readInputRow(input, items));
	const rows = hideSatisfied ? allRows.filter((row) => !row.satisfied) : allRows;

	if (rows.length === 0) return null;

	return (
		<UiSection title={title}>
			<div className="grid gap-2">
				{rows.map((row) => (
					<div
						key={row.key}
						className="flex min-w-0 items-start gap-2 rounded-sm bg-ak-surface px-2.5 py-2 text-sm"
					>
						{row.asset}
						<div className="min-w-0 flex-1">
							<p className="break-words font-semibold text-ak-text">{row.label}</p>
							{row.meta ? (
								<p className="mt-0.5 break-words text-xs leading-5 text-ak-text-muted">
									{row.meta}
								</p>
							) : null}
						</div>
						<span
							aria-hidden="true"
							className={
								row.satisfied
									? "mt-0.5 shrink-0 text-emerald-300"
									: "mt-0.5 shrink-0 text-rose-300"
							}
						>
							{row.satisfied ? "✓" : "✕"}
						</span>
					</div>
				))}
			</div>
		</UiSection>
	);
};
