import { Effect } from "effect";
import type { CursorSemantic } from "~/ui/cursor/CursorSemantic";

export namespace readControlCursorSemanticFx {
	export interface Props {
		readonly ariaDisabled?: boolean;
		readonly disabled?: boolean;
		readonly intent?: Extract<CursorSemantic, "pointer" | "progress" | "wait" | "not-allowed">;
	}
}

/** Resolves one shared control cursor without weakening native disabled semantics. */
export const readControlCursorSemanticFx = Effect.fn("readControlCursorSemanticFx")(
	({
		ariaDisabled = false,
		disabled = false,
		intent = "pointer",
	}: readControlCursorSemanticFx.Props) =>
		Effect.sync((): CursorSemantic => {
			if (!ariaDisabled && !disabled) return intent;
			return intent === "progress" || intent === "wait" ? intent : "not-allowed";
		}),
);
