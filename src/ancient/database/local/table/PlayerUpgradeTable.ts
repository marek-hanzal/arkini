import type { Timestamp } from "~/database/local/table/Timestamp";

export interface PlayerUpgradeTable {
	id: string;
	saveGameId: string;
	upgradeDefinitionId: string;
	level: number;
	targetLevel: number | null;
	startedAt: string | null;
	readyAt: string | null;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}
