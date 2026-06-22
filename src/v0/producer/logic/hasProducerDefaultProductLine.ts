import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";

export function hasProducerDefaultProductLine(activation: ActivationView | undefined) {
	return (
		activation?.kind === "producer" &&
		activation.productLines?.some((line) => line.isDefault) === true
	);
}
