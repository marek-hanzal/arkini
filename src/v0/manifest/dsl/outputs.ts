import type { ActivationOutput } from "~/v0/manifest/activation/ActivationOutput";

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
