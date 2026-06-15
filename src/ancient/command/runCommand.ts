import { bootstrapDatabase } from "~/play/logic/bootstrapDatabase";
import { runEffect } from "~/play/logic/runEffect";
import type { Command } from "./Command";
import type { CommandResult } from "./CommandResult";
import { runCommandFx } from "./runCommandFx";

export namespace runCommand {
	export interface Props<TCommand extends Command = Command> {
		command: TCommand;
	}
}

export const runCommand = async <TCommand extends Command>({
	command,
}: runCommand.Props<TCommand>): Promise<CommandResult<TCommand>> => {
	await bootstrapDatabase();

	return runEffect(
		runCommandFx({
			command,
		}),
	) as Promise<CommandResult<TCommand>>;
};
