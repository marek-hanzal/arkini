import { Effect } from "effect";

import { EditorMcpPortSchema } from "../../../electron/contract/editor/EditorMcpPortSchema";

export namespace parseEditorMcpPortFx {
	export type Result = EditorMcpPortSchema.Type | undefined;
}

/** Parses one Settings draft through the canonical renderer/Electron port contract. */
export const parseEditorMcpPortFx = Effect.fn("parseEditorMcpPortFx")((rawPort: string) =>
	Effect.succeed(
		EditorMcpPortSchema.safeParse(Number(rawPort.trim()))
			.data satisfies parseEditorMcpPortFx.Result,
	),
);
