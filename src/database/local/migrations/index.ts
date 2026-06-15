import type { Migration } from "kysely/migration";
import { migration0001Bootstrap } from "./0001_bootstrap";
import { migration0002PlayerUpgrades } from "./0002_player_upgrades";
import { migration0003UpgradeJobsAndProducerInputs } from "./0003_upgrade_jobs_and_producer_inputs";
import { migration0004ItemInstances } from "./0004_item_instances";
import { migration0005ActivationInputInstances } from "./0005_activation_input_instances";

export const migrations = {
	"0001_bootstrap": migration0001Bootstrap,
	"0002_player_upgrades": migration0002PlayerUpgrades,
	"0003_upgrade_jobs_and_producer_inputs": migration0003UpgradeJobsAndProducerInputs,
	"0004_item_instances": migration0004ItemInstances,
	"0005_activation_input_instances": migration0005ActivationInputInstances,
} satisfies Record<string, Migration>;
