import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { BuildCommandAtoms } from "~/editor-build/atom/BuildCommandAtoms";

const readErrorMessageFn = (error: unknown) =>
	error === undefined ? undefined : error instanceof Error ? error.message : String(error);

export namespace useEditorBuildSaveController {
	export interface Props {
		readonly artifact?: EditorProjectBuildSchema.Type;
	}

	export interface Output {
		readonly saveArtifactFn: () => void;
		readonly saveError?: string;
		readonly savePending: boolean;
	}
}

/** Owns saving one exact admitted build artifact outside the Editor repository. */
export const useEditorBuildSaveController = ({
	artifact,
}: useEditorBuildSaveController.Props): useEditorBuildSaveController.Output => {
	const saveAtom = BuildCommandAtoms.save(artifact?.contentHash ?? "unbuilt");
	const saveResult = useAtomValue(saveAtom);
	const runSaveFn = useAtomSet(saveAtom);
	const saveError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(saveResult));

	return {
		saveArtifactFn: () => {
			if (artifact !== undefined) runSaveFn(artifact);
		},
		saveError: readErrorMessageFn(saveError),
		savePending: saveResult.waiting,
	};
};
