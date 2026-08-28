import { useAtom } from "@effect/atom-react";
import { useEffect } from "react";

import type { CliInstallationStatus } from "~/bridge/cli/CliInstallation";
import { SettingsCliCommandAtom } from "~/ui/settings/SettingsCliCommandAtom";
import { useSettingsCliCompletionModel } from "~/ui/settings/useSettingsCliCompletionModel";

const describeCliInstallation = (status: CliInstallationStatus | undefined) => {
	if (status === undefined) return "Checking whether arkini-cli can be installed…";
	switch (status.type) {
		case "installed":
			return `arkini-cli is installed at ${status.commandPath}.`;
		case "not-installed":
			return `Install arkini-cli at ${status.commandPath}. Its directory must be on your shell PATH.`;
		case "repairable":
			return status.message;
		case "conflict":
		case "unavailable":
			return status.message;
	}
};

export const useSettingsCliModel = () => {
	const [state, runCommand] = useAtom(SettingsCliCommandAtom);
	useEffect(() => {
		runCommand("read");
	}, [
		runCommand,
	]);

	const status = "status" in state ? state.status : undefined;
	const pending = state.kind === "pending";
	const completion = useSettingsCliCompletionModel({
		commandInstalled: status?.type === "installed",
	});
	return {
		...completion,
		cliStatus: state,
		cliDescription: describeCliInstallation(status),
		cliPending: pending,
		cliDisabled:
			state.kind === "uninitialized" ||
			state.kind === "loading" ||
			(state.kind === "error" && status === undefined) ||
			(status?.type === "conflict" && !status.replaceable) ||
			status?.type === "unavailable",
		cliActionLabel: pending
			? state.action === "install"
				? state.status.type === "repairable"
					? "Repairing…"
					: "Installing…"
				: state.action === "replace"
					? "Replacing…"
					: "Uninstalling…"
			: status?.type === "installed"
				? "Uninstall"
				: status?.type === "repairable"
					? "Repair"
					: status?.type === "conflict"
						? "Replace"
						: "Install",
		toggleCliInstallation: () =>
			runCommand(
				status?.type === "installed"
					? "uninstall"
					: status?.type === "conflict"
						? "replace"
						: "install",
			),
	};
};

export type SettingsCliModel = ReturnType<typeof useSettingsCliModel>;
