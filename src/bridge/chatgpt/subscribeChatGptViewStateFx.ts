import { Effect } from "effect";
import {
	ChatGptViewStateSchema,
	type ChatGptViewStateSchema as ChatGptViewStateSchemaType,
} from "../../../electron/contract/chatgpt/ChatGptSurfaceSchema";

export type ChatGptViewState = ChatGptViewStateSchemaType.Type;

/** Subscribes to validated state from the isolated ChatGPT browser surface. */
export const subscribeChatGptViewStateFx = Effect.fn("subscribeChatGptViewStateFx")(
	(listener: (state: ChatGptViewState) => void) =>
		Effect.sync(() =>
			window.arkini.chatGpt.onStateChanged((candidate) =>
				listener(ChatGptViewStateSchema.parse(candidate)),
			),
		),
);
