import { syncConfigFx } from "../fx/syncConfigFx";
import type { GameConfigSyncResult } from "./GameConfigSyncResult";
import { runEffect } from "./runEffect";
import type { GameConfig } from "~/manifest/data/GameConfig";

export type { GameConfigSyncResult };

export function syncGameConfig(config?: GameConfig): Promise<GameConfigSyncResult> {
	return runEffect(
		syncConfigFx({
			config,
		}),
	);
}
