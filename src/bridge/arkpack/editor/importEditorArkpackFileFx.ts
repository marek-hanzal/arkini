import { Effect } from "effect";

import { ArkiniTrustedKeys } from "~/bridge/arkpack/ArkiniTrustedKeys";
import { ArkpackLimits } from "../../../../shared/ArkpackLimits";
import { readArkpackFx } from "~/bridge/arkpack/readArkpackFx";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";

interface EditorArkpackFileInput {
	readonly name: string;
	readonly size: number;
	readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

export namespace importEditorArkpackFileFx {
	export interface Props {
		readonly file: EditorArkpackFileInput;
	}
}

/** Validates one arkpack and atomically creates one canonical editor project. */
export const importEditorArkpackFileFx = Effect.fn("importEditorArkpackFileFx")(function* ({
	file,
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
		source: "user",
	});
	const repository = yield* EditorProjectRepository;
	const project = yield* repository.createProjectFx({
		projectId: loaded.payload.packageId,
		version: loaded.payload.version,
		config: loaded.payload.config,
		resources: loaded.payload.resources,
	});
	return project satisfies EditorProjectDescriptor;
});
