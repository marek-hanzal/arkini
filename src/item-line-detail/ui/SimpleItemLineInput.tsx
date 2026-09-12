import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { ItemLineInputFrame } from "~/item-line-detail/ui/ItemLineInputFrame";
import { UnitCostValue } from "~/production-input/ui/UnitCostValue";

type SimpleInput = Extract<
	ItemDetailLinesProjection.Input,
	{
		readonly kind: "simple";
	}
>;

/** Owns the fixed owner-unit presentation of a simple line input. */
export const SimpleItemLineInput = ({
	input,
	suppressSurface,
}: {
	readonly input: SimpleInput;
	readonly suppressSurface: boolean;
}) => (
	<ItemLineInputFrame
		inputKind="simple"
		state="empty"
		suppressSurface={suppressSurface}
	>
		<p className="font-medium text-foreground">Owner unit</p>
		<p className="text-right text-sm text-muted">
			<UnitCostValue unit={input.units} />
		</p>
	</ItemLineInputFrame>
);
