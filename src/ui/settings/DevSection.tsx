import { SettingsOpenActionRow } from "~/ui/settings/SettingsOpenActionRow";
import { useCliModel } from "~/ui/settings/useCliModel";
import { useSettingsDirectoriesModel } from "~/ui/settings/useSettingsDirectoriesModel";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const DevSection = () => {
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
				onClick={cli.toggleInstallation}
			/>
			<SettingsOpenActionRow
				dataUi="SettingsCliCompletion"
				title="Shell completion"
				description={cli.completionDescription}
				pending={cli.completionPending}
				disabled={cli.completionDisabled}
				idleLabel={cli.completionActionLabel}
				onClick={cli.toggleCompletion}
			/>
			<SettingsOpenActionRow
				dataUi="SettingsDiagnostics"
				title="Diagnostics"
				description="Open the bounded rotating logs used to investigate crashes and broken gameplay sessions."
				pending={directories.diagnosticsStatus.kind === "pending"}
				idleLabel="Open logs"
				onClick={directories.openDiagnostics}
			/>
			<SettingsOpenActionRow
				dataUi="SettingsUserData"
				title="Application data"
				description="Open Arkini's data root containing editor projects, Arkpacks, saves, preferences, and logs."
				pending={directories.userDataStatus.kind === "pending"}
				idleLabel="Open data folder"
				onClick={directories.openUserData}
			/>
			{directories.diagnosticsStatus.kind === "error" ? (
				<p className="text-center text-sm text-danger">
					Diagnostics failed: {errorMessage(directories.diagnosticsStatus.error)}
				</p>
			) : null}
			{directories.userDataStatus.kind === "error" ? (
				<p className="text-center text-sm text-danger">
					Opening data folder failed: {errorMessage(directories.userDataStatus.error)}
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
};
