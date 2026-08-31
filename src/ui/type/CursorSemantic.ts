/** Finite native cursor vocabulary used by Arkini interaction surfaces. */
export type CursorSemantic =
	| "default"
	| "pointer"
	| "text"
	| "grab"
	| "grabbing"
	| "progress"
	| "wait"
	| "not-allowed"
	| "auto";

/** Static Tailwind classes for the finite native cursor vocabulary. */
export const CursorClassName = {
	auto: "cursor-auto",
	default: "cursor-default",
	grab: "cursor-grab",
	grabbing: "cursor-grabbing",
	"not-allowed": "cursor-not-allowed",
	pointer: "cursor-pointer",
	progress: "cursor-progress",
	text: "cursor-text",
	wait: "cursor-wait",
} as const satisfies Record<CursorSemantic, string>;
