import { useAtom } from "@effect/atom-react";
import { useEffect } from "react";

import type { CompletionStatus } from "../../../electron/contract/cli/CompletionStatus";
import { CompletionCommandAtom } from "~/ui/settings/CompletionCommandAtom";

const shellLabel = (status: CompletionStatus) =>
	status.type === "unavailable"
		? "Shell"
		: status.shell === "zsh"
			? "Zsh"
			: status.shell === "bash"
				? "Bash"
				: "Fish";

const describeCompletion = (status: CompletionStatus | undefined) => {
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

export const useCliCompletionModel = ({
	commandInstalled,
}: {
	readonly commandInstalled: boolean;
}) => {
	const [state, runCommand] = useAtom(CompletionCommandAtom);
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
		completionStatus: state,
		completionDescription: describeCompletion(status),
		completionPending: pending,
		completionDisabled:
			(!commandInstalled && !cleanupWithoutCommand) ||
			state.kind === "uninitialized" ||
			state.kind === "loading" ||
			(state.kind === "error" && status === undefined) ||
			(status?.type === "conflict" && !status.replaceable) ||
			status?.type === "unavailable",
		completionActionLabel: cleanupWithoutCommand
			? "Uninstall"
			: status?.type === "installed"
				? "Uninstall"
				: status?.type === "repairable"
					? "Repair"
					: status?.type === "conflict"
						? "Replace"
						: "Install",
		toggleCompletion: () =>
			runCommand(
				cleanupWithoutCommand || status?.type === "installed"
					? "uninstall"
					: status?.type === "conflict"
						? "replace"
						: "install",
			),
	};
};

export type CliCompletionModel = ReturnType<typeof useCliCompletionModel>;
