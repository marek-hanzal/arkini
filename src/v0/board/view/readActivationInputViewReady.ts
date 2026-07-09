import type { ActivationInputView } from "~/board/view/ActivationInputViewSchema";
import { readActivationInputRequiredQuantity } from "~/activation/readActivationInputRequiredQuantity";

export const readActivationInputViewReady = (input: ActivationInputView) =>
	input.stored >= readActivationInputRequiredQuantity(input);
