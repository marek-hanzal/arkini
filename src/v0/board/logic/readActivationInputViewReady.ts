import type { ActivationInputView } from "~/v0/board/view/ActivationInputViewSchema";
import { readActivationInputRequiredQuantity } from "~/v0/game/activation/readActivationInputRequiredQuantity";

export const readActivationInputViewReady = (input: ActivationInputView) =>
	input.stored >= readActivationInputRequiredQuantity(input);
