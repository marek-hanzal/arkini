import { useAtom } from "@effect/atom-react";
import { useEffect } from "react";

import type { CliCompletionStatus } from "~/bridge/cli/readCliCompletionStatusFx";
import { SettingsCliCompletionCommandAtom } from "~/ui/settings/SettingsCliCompletionCommandAtom";

const shellLabel = (status: CliCompletionStatus) =>
	status.type === "unavailable"
		? "Shell"
		: status.shell === "zsh"
			? "Zsh"
			: status.shell === "bash"
				? "Bash"
				: "Fish";

const describeCompletion = (status: CliCompletionStatus | undefined) => {
	if (status === undefined) return "Checking shell completion support…";
	if (status.type === "unavailable") return status.message;
	if (status.type === "repairable" || status.type === "conflict") return status.message;
	const location = `${shellLabel(status)} completion ${
		status.type === "installed" ? "is installed" : "can be installed"
	} at ${status.completionPath}.`;
	return status.shell === "zsh"
		? `${location} Add ~/.zsh/completions to fpath and run compinit once if that directory is not already loaded.`
		: location;
};

export const useSettingsCliCompletionModel = ({
	commandInstalled,
}: {
	readonly commandInstalled: boolean;
}) => {
	const [state, runCommand] = useAtom(SettingsCliCompletionCommandAtom);
	useEffect(() => {
		runCommand("read");
	}, [
		runCommand,
	]);

	const status = "status" in state ? state.status : undefined;
	const pending = state.kind === "pending";
	const cleanupWithoutCommand =
		!commandInstalled && (status?.type === "installed" || status?.type === "repairable");
	return {
		cliCompletionStatus: state,
		cliCompletionDescription: describeCompletion(status),
		cliCompletionPending: pending,
		cliCompletionDisabled:
			(!commandInstalled && !cleanupWithoutCommand) ||
			state.kind === "uninitialized" ||
			state.kind === "loading" ||
			(state.kind === "error" && status === undefined) ||
			(status?.type === "conflict" && !status.replaceable) ||
			status?.type === "unavailable",
		cliCompletionActionLabel: pending
			? state.action === "install"
				? state.status.type === "repairable"
					? "Repairing…"
					: "Installing…"
				: state.action === "replace"
					? "Replacing…"
					: "Uninstalling…"
			: cleanupWithoutCommand
				? "Uninstall"
				: status?.type === "installed"
					? "Uninstall"
					: status?.type === "repairable"
						? "Repair"
						: status?.type === "conflict"
							? "Replace"
							: "Install",
		toggleCliCompletion: () =>
			runCommand(
				cleanupWithoutCommand || status?.type === "installed"
					? "uninstall"
					: status?.type === "conflict"
						? "replace"
						: "install",
			),
	};
};

export type SettingsCliCompletionModel = ReturnType<typeof useSettingsCliCompletionModel>;
