import type { LineSchema } from "~/production-line/schema/LineSchema";

/** Copies a line under a caller-supplied fresh UID, retaining Clock and clearing Default. */
export const duplicateLineFn = (line: LineSchema.Type, uid: string): LineSchema.Type => ({
	...structuredClone(line),
	uid,
	default: false,
});
