import { Effect } from "effect";

import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { invokeEditorTransportFx } from "~/bridge/editor/invokeEditorTransportFx";

export namespace createEditorWorkspaceFx {
	export interface Props {
		readonly api?: Window["arkini"]["editor"];
	}
}

/** Creates the narrow renderer capability for the canonical user-data editor root. */
export const createEditorWorkspaceFx = Effect.fn("createEditorWorkspaceFx")(
	({ api = window.arkini.editor }: createEditorWorkspaceFx.Props = {}) => {
		const createFx: EditorWorkspace["createFx"] = Effect.fn("EditorWorkspace.createFx")(
			(record) => invokeEditorTransportFx("create", () => api.createProject(record)),
		);
		const readFx: EditorWorkspace["readFx"] = Effect.fn("EditorWorkspace.readFx")(
			(projectId) => invokeEditorTransportFx("read", () => api.readProject(projectId)),
		);
		const openDirectoryFx: EditorWorkspace["openDirectoryFx"] = Effect.fn(
			"EditorWorkspace.openDirectoryFx",
		)((projectId) =>
			invokeEditorTransportFx("open-directory", () => api.openDirectory(projectId)),
		);
		return Effect.succeed({
			createFx,
			readFx,
			openDirectoryFx,
		} satisfies EditorWorkspace);
	},
);
