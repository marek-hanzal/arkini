import { Effect, Exit, FiberSet, Scope } from "effect";

import type { EditorMcpOverviewSchema } from "~/authoring-mcp/schema/EditorMcpOverviewSchema";
import type { EditorProjectServiceOwnership } from "~/project-authoring/service/EditorProjectServiceOwnership";
import {
	createEditorMcpOwnershipFx,
	type ServerOwnership,
} from "../http/createEditorMcpOwnershipFx";
import { createFilesystemEditorMcpStorageFx } from "../storage/createFilesystemEditorMcpStorageFx";
import { createNgrokEditorMcpTunnelFx } from "../tunnel/createNgrokEditorMcpTunnelFx";

export namespace createFilesystemEditorMcpOwnershipFx {
	export interface Props {
		readonly editor: EditorProjectServiceOwnership;
		readonly notifyOverviewChangedFn: (overview: EditorMcpOverviewSchema.Type) => void;
		readonly notifyProjectChangedFn: (projectId: string) => void;
		readonly root: string;
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
}: createFilesystemEditorMcpOwnershipFx.Props) {
	const callbackScope = yield* Scope.make();
	return yield* Effect.gen(function* () {
		const runPromiseFn = yield* FiberSet.makeRuntimePromise<never>().pipe(
			Scope.provide(callbackScope),
		);
		const storage = yield* createFilesystemEditorMcpStorageFx({
			root,
			runPromiseFn,
		});
		const tunnel = yield* createNgrokEditorMcpTunnelFx;
		const ownership = yield* createEditorMcpOwnershipFx({
			editor,
			notifyOverviewChangedFn,
			notifyProjectChangedFn,
			runPromiseFn,
			storage,
			tunnel,
		});
		const closeCallbacksFx = Scope.close(callbackScope, Exit.void);
		const filesystemOwnership: ServerOwnership = {
			...ownership,
			closeFx: ownership.closeFx.pipe(Effect.ensuring(closeCallbacksFx)),
			closeSyncFn: () => {
				ownership.closeSyncFn();
				void Effect.runPromise(closeCallbacksFx).catch((cause) =>
					console.error("Editor MCP callbacks could not close.", cause),
				);
			},
		};
		return filesystemOwnership;
	}).pipe(Effect.onError(() => Scope.close(callbackScope, Exit.void)));
});
