import { Effect } from "effect";

import { replaceFilesystemEditorFileFx } from "./replaceFilesystemEditorFileFx";

const encoder = new TextEncoder();

/** Serializes one readable JSON document and atomically replaces its exact target. */
export const replaceFilesystemEditorJsonFx = Effect.fn("replaceFilesystemEditorJsonFx")(
	(target: string, value: unknown) =>
		replaceFilesystemEditorFileFx({
			target,
			bytes: encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`),
		}),
);
