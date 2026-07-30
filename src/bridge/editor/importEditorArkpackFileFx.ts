import { Effect } from "effect";

import { ArkiniTrustedKeys } from "~/bridge/arkpack/ArkiniTrustedKeys";
import { ArkpackLimits } from "~/bridge/arkpack/ArkpackLimits";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import {
	createEditorProjectManifestFileFx,
} from "~/bridge/editor/createEditorProjectManifestFileFx";
import { createEditorWorkspaceFx } from "~/bridge/editor/createEditorWorkspaceFx";
import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { createEditorProjectPlanFx } from "~/engine/editor/fx/createEditorProjectPlanFx";

interface EditorArkpackFileInput {
	readonly name: string;
	readonly size: number;
	readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

export namespace importEditorArkpackFileFx {
	export interface Props {
		readonly file: EditorArkpackFileInput;
		readonly workspace?: EditorWorkspace;
	}
}

/** Validates one arkpack and atomically expands it into the user-data editor workspace. */
export const importEditorArkpackFileFx = Effect.fn("importEditorArkpackFileFx")(function* ({
	file,
	workspace: providedWorkspace,
}: importEditorArkpackFileFx.Props) {
	if (!file.name.toLowerCase().endsWith(".arkpack")) {
		return yield* Effect.fail(new Error("Choose a .arkpack file."));
	}
	if (file.size > ArkpackLimits.maxCompressedBytes) {
		return yield* Effect.fail(
			new Error(
				`Arkpack exceeds the ${ArkpackLimits.maxCompressedBytes} byte compressed limit.`,
			),
		);
	}
	const bytes = yield* Effect.tryPromise({
		try: async () => new Uint8Array(await file.arrayBuffer()),
		catch: (cause) => cause,
	});
	const loaded = yield* readArkpackFx({
		bytes,
		filename: file.name,
		signature: {
			trustedKeys: ArkiniTrustedKeys,
		},
		source: "imported",
	});
	const plan = yield* createEditorProjectPlanFx({
		contentHash: loaded.descriptor.contentHash,
		payload: loaded.payload,
	});
	const manifest = yield* createEditorProjectManifestFileFx({
		projectId: plan.projectId,
		title: plan.title,
		game: plan.version,
	});
	const workspace = providedWorkspace ?? (yield* createEditorWorkspaceFx());
	yield* workspace.createFx({
		projectId: plan.projectId,
		files: [
			manifest.file,
			...plan.files,
		],
	});
	return manifest.descriptor satisfies EditorProjectDescriptor;
});
