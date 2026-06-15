import type { ActivationOutput } from "~/v0/manifest/activation/ActivationOutput";
import type { ActivationWeightedEntry } from "~/v0/manifest/activation/ActivationWeightedEntry";
import type { Quantity } from "~/v0/manifest/activation/Quantity";

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
