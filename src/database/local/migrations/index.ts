import type { Migration } from "kysely/migration";
import { migration0001Bootstrap } from "./0001_bootstrap";
import { migration0002PlayerResource } from "./0002_player_resource";
import { migration0003PlayerInventoryUpgrades } from "./0003_player_inventory_upgrades";

export const migrations = {
	"0001_bootstrap": migration0001Bootstrap,
	"0002_player_resource": migration0002PlayerResource,
	"0003_player_inventory_upgrades": migration0003PlayerInventoryUpgrades,
} satisfies Record<string, Migration>;
