import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readWorldSnapshotFactsFx } from "~/world/readWorldSnapshotFactsFx";
import { readWorldSnapshotIssuesFx } from "~/world/readWorldSnapshotIssuesFx";
import type { WorldSnapshotCheckId } from "~/world/WorldSnapshotCheckId";

export namespace validateWorldSnapshotFx {
	export interface Props {
		checks?: readonly WorldSnapshotCheckId[];
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const validateWorldSnapshotFx = Effect.fn("validateWorldSnapshotFx")(function* ({
	checks,
	config,
	nowMs,
	save,
}: validateWorldSnapshotFx.Props) {
	const facts = yield* readWorldSnapshotFactsFx({
		config,
		nowMs,
		save,
	});
	const issues = yield* readWorldSnapshotIssuesFx({
		checks,
		facts,
		save,
	});

	return {
		facts,
		issues,
	};
});
