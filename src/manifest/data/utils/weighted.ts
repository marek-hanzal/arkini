import type { ActivationOutput, ActivationWeightedEntry, Quantity } from "../producer";

export namespace weighted {
	export interface Props {
		entries: readonly ActivationWeightedEntry[];
		rolls?: Quantity;
	}
}

export const weighted = (props: weighted.Props): ActivationOutput => {
	const { entries, rolls = 1 } = props;

	return {
		type: "weighted",
		entries,
		rolls,
	};
};
