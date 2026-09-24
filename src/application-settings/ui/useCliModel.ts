import { match, P } from "ts-pattern";
import { useAtom } from "@effect/atom-react";
import { useEffect } from "react";

import type { InstallationStatus } from "~electron/contract/cli/InstallationStatus";
import { CliCommandAtom } from "~/application-settings/atom/CliCommandAtom";
import { useCliCompletionModel } from "~/application-settings/ui/useCliCompletionModel";

const describeInstallationFn = (status: InstallationStatus | undefined) =>
	match(status)
		.with(undefined, () => "Checking whether serakki-cli can be installed…")
		.with(
			{
				type: "installed",
			},
			({ commandPath }) => `serakki-cli is installed at ${commandPath}.`,
		)
		.with(
			{
				type: "not-installed",
			},
			({ commandPath }) =>
				`Install serakki-cli at ${commandPath}. Its directory must be on your shell PATH.`,
		)
		.with(
			{
				type: P.union("repairable", "conflict", "unavailable"),
			},
			({ message }) => message,
		)
		.exhaustive();

export const useCliModel = () => {
	const [state, runCommandFn] = useAtom(CliCommandAtom);
	useEffect(() => {
		runCommandFn("read");
	}, [
		runCommandFn,
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
		installationActionLabel: match(status?.type)
			.with("installed", () => "Uninstall")
			.with("repairable", () => "Repair")
			.with("conflict", () => "Replace")
			.with(undefined, "not-installed", "unavailable", () => "Install")
			.exhaustive(),
		toggleInstallationFn: () =>
			runCommandFn(
				match(status?.type)
					.with("installed", () => "uninstall" as const)
					.with("conflict", () => "replace" as const)
					.with(
						undefined,
						"repairable",
						"not-installed",
						"unavailable",
						() => "install" as const,
					)
					.exhaustive(),
			),
	};
};
