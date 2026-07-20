import type { CursorSemantic } from "~/ui/cursor/CursorSemantic";

export namespace readControlCursorSemantic {
	export interface Props {
		readonly ariaDisabled?: boolean;
		readonly disabled?: boolean;
		readonly intent?: Extract<CursorSemantic, "pointer" | "progress" | "wait" | "not-allowed">;
	}
}

/** Resolves one shared control cursor without weakening native disabled semantics. */
export const readControlCursorSemantic = ({
	ariaDisabled = false,
	disabled = false,
	intent = "pointer",
}: readControlCursorSemantic.Props): CursorSemantic => {
	if (!ariaDisabled && !disabled) return intent;
	return intent === "progress" || intent === "wait" ? intent : "not-allowed";
};
