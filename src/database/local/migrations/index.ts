import type { Migration } from "kysely/migration";
import { migration0001Bootstrap } from "./0001_bootstrap";
import { migration0002PlayerInventoryUpgrades } from "./0002_player_inventory_upgrades";

export const migrations = {
	"0001_bootstrap": migration0001Bootstrap,
	"0002_player_inventory_upgrades": migration0002PlayerInventoryUpgrades,
} satisfies Record<string, Migration>;
