import { match, P } from "ts-pattern";
import { useAtom } from "@effect/atom-react";
import { useEffect } from "react";

import type { CompletionStatus } from "~electron/contract/cli/CompletionStatus";
import { CompletionCommandAtom } from "~/application-settings/atom/CompletionCommandAtom";

const shellLabelFn = (status: CompletionStatus) =>
	match(status)
		.with(
			{
				type: "unavailable",
			},
			() => "Shell",
		)
		.with(
			{
				shell: "zsh",
			},
			() => "Zsh",
		)
		.with(
			{
				shell: "bash",
			},
			() => "Bash",
		)
		.with(
			{
				shell: "fish",
			},
			() => "Fish",
		)
		.exhaustive();

const describeCompletionFn = (status: CompletionStatus | undefined) =>
	match(status)
		.with(undefined, () => "Checking shell completion support…")
		.with(
			{
				type: P.union("unavailable", "repairable", "conflict"),
			},
			({ message }) => message,
		)
		.with(
			{
				type: P.union("installed", "not-installed"),
			},
			(status) => {
				const location = `${shellLabelFn(status)} completion ${status.type === "installed" ? "is installed" : "can be installed"} at ${status.completionPath}.`;
				return status.shell === "zsh"
					? `${location} Add ~/.zsh/completions to fpath and run compinit once if that directory is not already loaded.`
					: location;
			},
		)
		.exhaustive();

export const useCliCompletionModel = ({
	commandInstalled,
}: {
	readonly commandInstalled: boolean;
}) => {
	const [state, runCommandFn] = useAtom(CompletionCommandAtom);
	useEffect(() => {
		runCommandFn("read");
	}, [
		runCommandFn,
	]);

	const status = "status" in state ? state.status : undefined;
	const pending = state.kind === "pending";
	const cleanupWithoutCommand =
		!commandInstalled && (status?.type === "installed" || status?.type === "repairable");
	return {
		completionStatus: state,
		completionDescription: describeCompletionFn(status),
		completionPending: pending,
		completionDisabled:
			(!commandInstalled && !cleanupWithoutCommand) ||
			state.kind === "uninitialized" ||
			state.kind === "loading" ||
			(state.kind === "error" && status === undefined) ||
			(status?.type === "conflict" && !status.replaceable) ||
			status?.type === "unavailable",
		completionActionLabel: match({
			cleanupWithoutCommand,
			type: status?.type,
		})
			.with(
				{
					cleanupWithoutCommand: true,
				},
				{
					type: "installed",
				},
				() => "Uninstall",
			)
			.with(
				{
					type: "repairable",
				},
				() => "Repair",
			)
			.with(
				{
					type: "conflict",
				},
				() => "Replace",
			)
			.with(
				{
					type: P.union(undefined, "not-installed", "unavailable"),
				},
				() => "Install",
			)
			.exhaustive(),
		toggleCompletionFn: () =>
			runCommandFn(
				match({
					cleanupWithoutCommand,
					type: status?.type,
				})
					.with(
						{
							cleanupWithoutCommand: true,
						},
						{
							type: "installed",
						},
						() => "uninstall" as const,
					)
					.with(
						{
							type: "conflict",
						},
						() => "replace" as const,
					)
					.with(
						{
							type: P.union(undefined, "repairable", "not-installed", "unavailable"),
						},
						() => "install" as const,
					)
					.exhaustive(),
			),
	};
};
