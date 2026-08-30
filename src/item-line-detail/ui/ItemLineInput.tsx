import { match } from "ts-pattern";

import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { DepositItemLineInput } from "~/item-line-detail/ui/DepositItemLineInput";
import { MaterialItemLineInput } from "~/item-line-detail/ui/MaterialItemLineInput";
import { SimpleItemLineInput } from "~/item-line-detail/ui/SimpleItemLineInput";

/** Selects one explicit presentation owner for each projected input grammar. */
export const ItemLineInput = ({
	disabled,
	input,
	lineId,
	ownerItemId,
	stale,
	suppressSurface,
}: {
	readonly disabled: boolean;
	readonly input: ItemDetailLinesProjection.Input;
	readonly lineId: string;
	readonly ownerItemId: string;
	readonly stale: boolean;
	readonly suppressSurface: boolean;
}) =>
	match(input)
		.with(
			{
				kind: "materials",
			},
			(materials) => (
				<MaterialItemLineInput
					disabled={disabled}
					input={materials}
					lineId={lineId}
					ownerItemId={ownerItemId}
					stale={stale}
					suppressSurface={suppressSurface}
				/>
			),
		)
		.with(
			{
				kind: "deposit",
			},
			(deposit) => (
				<DepositItemLineInput
					disabled={disabled}
					input={deposit}
					stale={stale}
					suppressSurface={suppressSurface}
				/>
			),
		)
		.with(
			{
				kind: "simple",
			},
			(simple) => (
				<SimpleItemLineInput
					input={simple}
					suppressSurface={suppressSurface}
				/>
			),
		)
		.exhaustive();
