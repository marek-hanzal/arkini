import type { PlayDataInvalidationTarget } from "~/play/hook/PlayDataInvalidationTarget";
import type { Command } from "./Command";

export namespace commandInvalidation {
	export interface Props {
		command: Command;
	}
}

export const commandInvalidation = ({
	command,
}: commandInvalidation.Props): readonly PlayDataInvalidationTarget[] => {
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
		case "activation.activate":
		case "activation.withdrawInput":
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
