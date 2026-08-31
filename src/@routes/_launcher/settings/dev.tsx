import { useAtom } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";

import { SettingsOpenActionRow } from "~/application-settings/ui/SettingsOpenActionRow";
import { SettingsDiagnosticsCommandAtom } from "~/application-settings/atom/SettingsDiagnosticsCommandAtom";
import { SettingsUserDataCommandAtom } from "~/application-settings/atom/SettingsUserDataCommandAtom";
import { useCliModel } from "~/application-settings/ui/useCliModel";

const errorMessageFn = (error: unknown) => (error instanceof Error ? error.message : String(error));

const useSettingsDirectoriesModel = () => {
	const [diagnosticsStatus, openDiagnosticsCommandFn] = useAtom(SettingsDiagnosticsCommandAtom);
	const [userDataStatus, openUserDataCommandFn] = useAtom(SettingsUserDataCommandAtom);

	return {
		diagnosticsStatus,
		userDataStatus,
		openDiagnosticsFn: () => openDiagnosticsCommandFn(undefined),
		openUserDataFn: () => openUserDataCommandFn(undefined),
	};
};

export const Route = createFileRoute("/_launcher/settings/dev")({
	component: () => {
		const cli = useCliModel();
		const directories = useSettingsDirectoriesModel();
		return (
			<section
				className="grid gap-3"
				data-ui="SettingsDev"
			>
				<SettingsOpenActionRow
					dataUi="SettingsCli"
					title="Command line"
					description={cli.installationDescription}
					pending={cli.installationPending}
					disabled={cli.installationDisabled}
					idleLabel={cli.installationActionLabel}
					onClickFn={cli.toggleInstallationFn}
				/>
				<SettingsOpenActionRow
					dataUi="SettingsCliCompletion"
					title="Shell completion"
					description={cli.completionDescription}
					pending={cli.completionPending}
					disabled={cli.completionDisabled}
					idleLabel={cli.completionActionLabel}
					onClickFn={cli.toggleCompletionFn}
				/>
				<SettingsOpenActionRow
					dataUi="SettingsDiagnostics"
					title="Diagnostics"
					description="Open the bounded rotating logs used to investigate crashes and broken gameplay sessions."
					pending={directories.diagnosticsStatus.kind === "pending"}
					idleLabel="Open logs"
					onClickFn={directories.openDiagnosticsFn}
				/>
				<SettingsOpenActionRow
					dataUi="SettingsUserData"
					title="Application data"
					description="Open Arkini's data root containing editor projects, Arkpacks, saves, preferences, and logs."
					pending={directories.userDataStatus.kind === "pending"}
					idleLabel="Open data folder"
					onClickFn={directories.openUserDataFn}
				/>
				{directories.diagnosticsStatus.kind === "error" ? (
					<p className="text-center text-sm text-danger">
						Diagnostics failed: {errorMessageFn(directories.diagnosticsStatus.error)}
					</p>
				) : null}
				{directories.userDataStatus.kind === "error" ? (
					<p className="text-center text-sm text-danger">
						Opening data folder failed:{" "}
						{errorMessageFn(directories.userDataStatus.error)}
					</p>
				) : null}
				{cli.installationStatus.kind === "error" ? (
					<p className="text-center text-sm text-danger">
						CLI installation failed: {cli.installationStatus.message}
					</p>
				) : null}
				{cli.completionStatus.kind === "error" ? (
					<p className="text-center text-sm text-danger">
						Shell completion failed: {cli.completionStatus.message}
					</p>
				) : null}
			</section>
		);
	},
});
