import { useAtom } from "@effect/atom-react";
import { useEffect } from "react";

import type { InstallationStatus } from "~electron/contract/cli/InstallationStatus";
import { CliCommandAtom } from "~/application-settings/atom/CliCommandAtom";
import { useCliCompletionModel } from "~/application-settings/ui/useCliCompletionModel";

const describeInstallationFn = (status: InstallationStatus | undefined) => {
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

export const useCliModel = () => {
	const [state, runCommand] = useAtom(CliCommandAtom);
	useEffect(() => {
		runCommand("read");
	}, [
		runCommand,
	]);

	const status = "status" in state ? state.status : undefined;
	const pending = state.kind === "pending";
	const completion = useCliCompletionModel({
		commandInstalled: status?.type === "installed",
	});
	return {
		...completion,
		installationStatus: state,
		installationDescription: describeInstallationFn(status),
		installationPending: pending,
		installationDisabled:
			state.kind === "uninitialized" ||
			state.kind === "loading" ||
			(state.kind === "error" && status === undefined) ||
			(status?.type === "conflict" && !status.replaceable) ||
			status?.type === "unavailable",
		installationActionLabel:
			status?.type === "installed"
				? "Uninstall"
				: status?.type === "repairable"
					? "Repair"
					: status?.type === "conflict"
						? "Replace"
						: "Install",
		toggleInstallation: () =>
			runCommand(
				status?.type === "installed"
					? "uninstall"
					: status?.type === "conflict"
						? "replace"
						: "install",
			),
	};
};
