import { AnimatePresence } from "motion/react";

import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { ItemLineInput } from "~/item-line-detail/ui/ItemLineInput";
import {
	ItemLineInputsHeader,
	type ItemLineInputsWithdrawAction,
} from "~/item-line-detail/ui/ItemLineInputWithdrawal";

/** Renders the full authored input side of one visible product line. */
export const ItemLineInputs = ({
	disabled,
	input,
	lineId,
	ownerItemId,
	stale = false,
	suppressSurface = false,
	withdraw,
}: {
	readonly disabled: boolean;
	readonly input: readonly ItemDetailLinesProjection.Input[];
	readonly lineId: string;
	readonly ownerItemId: string;
	readonly stale?: boolean;
	readonly suppressSurface?: boolean;
	readonly withdraw?: ItemLineInputsWithdrawAction;
}) => (
	<section className="min-w-0">
		<ItemLineInputsHeader withdraw={withdraw} />
		{input.length === 0 ? (
			<p className="py-3 text-sm text-muted">No material input required.</p>
		) : (
			<div
				className="space-y-1 pt-2"
				data-ui="TileLineInputsList"
			>
				<AnimatePresence
					initial={false}
					mode="popLayout"
				>
					{input.map((entry, index) => (
						<ItemLineInput
							key={`${entry.kind}:${index}`}
							disabled={disabled}
							input={entry}
							lineId={lineId}
							ownerItemId={ownerItemId}
							stale={stale}
							suppressSurface={suppressSurface}
						/>
					))}
				</AnimatePresence>
			</div>
		)}
	</section>
);
