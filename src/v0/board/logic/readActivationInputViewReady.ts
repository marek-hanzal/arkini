import type { ActivationInputView } from "~/v0/board/view/ActivationInputViewSchema";

export const readActivationInputViewReady = (input: ActivationInputView) =>
	input.stored >= input.quantity;
