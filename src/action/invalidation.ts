import type { PlayDataInvalidationTarget } from "~/play/hook/usePlayDataInvalidation";
import type { Command } from "./command";

export namespace invalidation {
	export interface Props {
		command: Command;
	}
}

export const invalidation = ({
	command,
}: invalidation.Props): readonly PlayDataInvalidationTarget[] => {
	switch (command.type) {
		case "board.move":
		case "board.swap":
		case "board.merge":
			return [
				"board",
				"databaseStatus",
			];
		case "inventory.swap":
			return [
				"inventory",
				"databaseStatus",
			];
		case "inventory.place":
		case "inventory.stash":
		case "producer.activate":
		case "producer.withdrawInput":
			return [
				"board",
				"inventory",
				"databaseStatus",
			];
		case "upgrade.buy":
			return [
				"board",
				"inventory",
				"upgrades",
				"databaseStatus",
			];
	}
};
