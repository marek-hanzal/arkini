import { Effect } from "effect";
import {
	ChatGptAssetCandidateSchema,
	type ChatGptAssetCandidateSchema as ChatGptAssetCandidateSchemaType,
} from "../../../electron/contract/chatgpt/ChatGptSurfaceSchema";

/** Subscribes to bounded PNG candidates emitted by the isolated ChatGPT surface. */
export const subscribeChatGptAssetCandidateFx = Effect.fn("subscribeChatGptAssetCandidateFx")(
	(listener: (candidate: ChatGptAssetCandidateSchemaType.Type) => void) =>
		Effect.sync(() =>
			window.arkini.chatGpt.onAssetCandidate((candidate) =>
				listener(ChatGptAssetCandidateSchema.parse(candidate)),
			),
		),
);
