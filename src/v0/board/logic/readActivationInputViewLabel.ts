import type { ActivationInputView } from "~/v0/board/view/ActivationInputViewSchema";

export const readActivationInputViewLabel = (input: ActivationInputView) =>
	input.mode === "upTo"
		? `${input.stored}/up to ${input.quantity}`
		: `${input.stored}/${input.quantity}`;
