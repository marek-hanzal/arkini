import type { ActivationInputView } from "~/board/view/ActivationInputViewSchema";

export const readActivationInputViewFillableQuantity = (input: ActivationInputView) =>
	Math.min(Math.max(0, input.quantity - input.stored), input.available ?? 0);
