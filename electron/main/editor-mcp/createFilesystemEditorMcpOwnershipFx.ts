import { Effect } from "effect";

import type { EditorMcpOverviewSchema } from "~electron/contract/editor/EditorMcpOverviewSchema";
import type { EditorProjectServiceOwnership } from "~electron/main/editor-project/EditorProjectServiceOwnership";
import { createEditorMcpOwnershipFx } from "./http/createEditorMcpOwnershipFx";
import { createFilesystemEditorMcpStorageFx } from "./storage/createFilesystemEditorMcpStorageFx";
import { createNgrokEditorMcpTunnelFx } from "./tunnel/createNgrokEditorMcpTunnelFx";

export namespace createFilesystemEditorMcpOwnershipFx {
	export interface Props {
		readonly editor: EditorProjectServiceOwnership;
		readonly notifyOverviewChangedFn: (overview: EditorMcpOverviewSchema.Type) => void;
		readonly notifyProjectChangedFn: (projectId: string) => void;
		readonly root: string;
		readonly runPromiseFn: <Value, Error>(
			effect: Effect.Effect<Value, Error, never>,
		) => Promise<Value>;
	}
}

/** Composes the installation-wide MCP storage, HTTP ownership and ngrok transport. */
export const createFilesystemEditorMcpOwnershipFx = Effect.fn(
	"createFilesystemEditorMcpOwnershipFx",
)(function* ({
	editor,
	notifyOverviewChangedFn,
	notifyProjectChangedFn,
	root,
	runPromiseFn,
}: createFilesystemEditorMcpOwnershipFx.Props) {
	const storage = yield* createFilesystemEditorMcpStorageFx({
		root,
	});
	const tunnel = yield* createNgrokEditorMcpTunnelFx;
	return yield* createEditorMcpOwnershipFx({
		editor,
		notifyOverviewChangedFn,
		notifyProjectChangedFn,
		runPromiseFn,
		storage,
		tunnel,
	});
});
