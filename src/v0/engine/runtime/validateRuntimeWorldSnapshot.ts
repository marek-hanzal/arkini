import { validateWorldSnapshotFx } from "~/world/validateWorldSnapshotFx";
import { runGameEngineEffect } from "~/engine/runtime/runGameEngineEffect";
import type { RuntimeGameEngineAdapterScope } from "~/engine/runtime/RuntimeGameEngineAdapterScope";
import type { RuntimeGameEngineValidateSnapshotProps } from "~/engine/runtime/RuntimeGameEngineAdapterTypes";

export const validateRuntimeWorldSnapshot = (
	scope: RuntimeGameEngineAdapterScope,
	{ checks, nowMs = Date.now() }: RuntimeGameEngineValidateSnapshotProps = {},
) =>
	runGameEngineEffect(
		validateWorldSnapshotFx({
			checks,
			config: scope.config,
			nowMs,
			save: scope.readSave(),
		}),
		{
			random: scope.random,
		},
	);
