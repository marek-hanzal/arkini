import type { PlayDataInvalidationTarget } from "~/play/hook/usePlayDataInvalidation";
import type { GameCommand } from "./GameCommand";

export namespace gameCommandInvalidation {
	export interface Props {
		command: GameCommand;
	}
}

export const gameCommandInvalidation = ({
	command,
}: gameCommandInvalidation.Props): readonly PlayDataInvalidationTarget[] => {
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
