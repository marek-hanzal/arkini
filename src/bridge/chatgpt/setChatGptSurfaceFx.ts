import { Effect } from "effect";
import type { ChatGptSurfaceSchema } from "../../../electron/contract/chatgpt/ChatGptSurfaceSchema";

/** Projects the renderer's desired ChatGPT surface into its owning native window. */
export const setChatGptSurfaceFx = Effect.fn("setChatGptSurfaceFx")(
	(surface: ChatGptSurfaceSchema.Type | null) =>
		Effect.tryPromise({
			try: () => window.arkini.chatGpt.setSurface(surface),
			catch: (cause) => cause,
		}),
);
