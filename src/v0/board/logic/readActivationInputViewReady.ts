import type { ActivationInputView } from "~/v0/board/view/ActivationInputViewSchema";
import { readActivationInputRequiredQuantity } from "~/v0/game/requirements/readActivationInputRequiredQuantity";

export const readActivationInputViewReady = (input: ActivationInputView) =>
	input.stored >= readActivationInputRequiredQuantity(input);
