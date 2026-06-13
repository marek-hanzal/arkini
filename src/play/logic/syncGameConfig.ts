import { syncConfigFx, type GameConfigSyncResult } from "./fx/syncConfigFx";
import { runFx } from "./fx/runFx";
import type { GameConfig } from "~/manifest/data/GameConfig";

export type { GameConfigSyncResult };

export function syncGameConfig(config?: GameConfig): Promise<GameConfigSyncResult> {
	return runFx(
		syncConfigFx({
			config,
		}),
	);
}
