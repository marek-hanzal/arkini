import { Effect } from "effect";
import { EditorMcpOverviewSchema } from "../../../electron/contract/editor/EditorMcpOverviewSchema";

export type EditorMcpOverview = EditorMcpOverviewSchema.Type;

export const parseEditorMcpOverview = (candidate: unknown) =>
	EditorMcpOverviewSchema.safeParse(candidate);

export const readEditorMcpOverviewFx = Effect.tryPromise({
	try: async () => EditorMcpOverviewSchema.parse(await window.arkini.editorMcp.readOverview()),
	catch: (cause) => cause,
});
