import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { ItemLineInputFrame } from "~/item-line-detail/ui/ItemLineInputFrame";

type SimpleInput = Extract<
	ItemDetailLinesProjection.Input,
	{
		readonly kind: "simple";
	}
>;

/** Owns the fixed owner-charge presentation of a simple line input. */
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
		<p className="font-medium text-foreground">Owner charge</p>
		<p className="text-right text-sm text-muted">
			{input.charges.cost} charge{input.charges.cost === 1 ? "" : "s"} from{" "}
			{input.charges.from === "self" ? "owner" : "target"}
		</p>
	</ItemLineInputFrame>
);
