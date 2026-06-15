import { match } from "ts-pattern";
import type { PlayDataInvalidationTarget } from "~/play/hook/PlayDataInvalidationTarget";
import type { Command } from "./Command";

export namespace commandInvalidation {
	export interface Props {
		command: Command;
	}
}

const targets = (
	...targets: readonly PlayDataInvalidationTarget[]
): readonly PlayDataInvalidationTarget[] => targets;

export const commandInvalidation = ({
	command,
}: commandInvalidation.Props): readonly PlayDataInvalidationTarget[] =>
	match(command)
		.with(
			{
				type: "board.move",
			},
			{
				type: "board.swap",
			},
			{
				type: "board.merge",
			},
			() => targets("board", "databaseStatus"),
		)
		.with(
			{
				type: "inventory.swap",
			},
			() => targets("inventory", "databaseStatus"),
		)
		.with(
			{
				type: "inventory.place",
			},
			{
				type: "inventory.stash",
			},
			{
				type: "activation.activate",
			},
			{
				type: "activation.withdrawInput",
			},
			{
				type: "craft.claim",
			},
			() => targets("board", "inventory", "databaseStatus"),
		)
		.with(
			{
				type: "upgrade.buy",
			},
			() => targets("board", "inventory", "upgrades", "databaseStatus"),
		)
		.exhaustive();
