import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { WorldSnapshotCheckId } from "~/world/WorldSnapshotCheckId";
import type { WorldSnapshotFacts } from "~/world/WorldSnapshotFacts";

export interface WorldSnapshotValidationScope {
	checks?: readonly WorldSnapshotCheckId[];
	facts: WorldSnapshotFacts;
	save: GameSave;
}
