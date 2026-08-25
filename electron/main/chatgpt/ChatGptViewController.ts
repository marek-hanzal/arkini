import type { Effect } from "effect";
import type { ChatGptSurfaceSchema } from "../../contract/chatgpt/ChatGptSurfaceSchema";

/** Owns the isolated ChatGPT WebContentsView attached to one Arkini window. */
export interface ChatGptViewController {
	readonly setSurfaceFx: (
		surface: ChatGptSurfaceSchema.Type | null,
	) => Effect.Effect<void, unknown>;
}
