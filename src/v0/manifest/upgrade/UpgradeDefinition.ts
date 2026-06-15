import type { UpgradeId } from "~/v0/manifest/manifestId";
import type { UpgradeTierDefinition } from "~/v0/manifest/upgrade/UpgradeTierDefinition";

export interface UpgradeDefinition {
	id: UpgradeId;
	code: string;
	name: string;
	description: string;
	sort: number;
	tiers: readonly UpgradeTierDefinition[];
}
