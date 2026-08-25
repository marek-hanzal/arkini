import { Effect } from "effect";
import { EditorMcpOverviewSchema } from "../../../electron/contract/editor/EditorMcpOverviewSchema";

export const readEditorMcpOverviewFx = Effect.tryPromise({
	try: async () => EditorMcpOverviewSchema.parse(await window.arkini.editorMcp.readOverview()),
	catch: (cause) => cause,
});
