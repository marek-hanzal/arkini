import type { ActivationOutput } from "../producer";

export namespace outputs {
	export interface Props {
		entries: readonly ActivationOutput[];
	}
}

export const outputs = (props: outputs.Props): ActivationOutput[] => {
	const { entries } = props;

	return [
		...entries,
	];
};
