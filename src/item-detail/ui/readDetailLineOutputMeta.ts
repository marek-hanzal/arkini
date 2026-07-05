import type { LineView } from "~/board/view/LineViewSchema";
import { joinTextParts } from "~/ui/joinTextParts";
import { formatDetailLinePercent } from "~/item-detail/ui/formatDetailLinePercent";

type DetailLineOutputView = NonNullable<LineView["outputs"]>[number];

const readQuantityLabel = (quantity: DetailLineOutputView["quantity"]) => {
	const resolvedQuantity = quantity ?? 1;
	return typeof resolvedQuantity === "number"
		? `${resolvedQuantity}×`
		: `${resolvedQuantity.min}-${resolvedQuantity.max}×`;
};

const readOutputProbabilityLabel = (output: DetailLineOutputView) => {
	if (output.probability === undefined) {
		return output.kind === "guaranteed" ? "guaranteed" : undefined;
	}

	return output.kind === "weighted"
		? `${formatDetailLinePercent(output.probability)}/roll`
		: `${formatDetailLinePercent(output.probability)} chance`;
};

export const readDetailLineOutputMeta = (output: DetailLineOutputView) =>
	joinTextParts([
		output.enabled === false ? "disabled" : undefined,
		readQuantityLabel(output.quantity),
		readOutputProbabilityLabel(output),
		output.rollLabel,
		`Owned ${output.ownedQuantity}`,
	]);
