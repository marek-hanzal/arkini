import type { Migration } from "kysely/migration";
import { migration0001Bootstrap } from "./0001_bootstrap";
import { migration0002PlayerInventoryUpgrades } from "./0002_player_inventory_upgrades";
import { migration0003UpgradeJobsAndProducerInputs } from "./0003_upgrade_jobs_and_producer_inputs";

export const migrations = {
	"0001_bootstrap": migration0001Bootstrap,
	"0002_player_inventory_upgrades": migration0002PlayerInventoryUpgrades,
	"0003_upgrade_jobs_and_producer_inputs": migration0003UpgradeJobsAndProducerInputs,
} satisfies Record<string, Migration>;
