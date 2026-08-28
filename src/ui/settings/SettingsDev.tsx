import { SettingsOpenActionRow } from "~/ui/settings/SettingsOpenActionRow";
import { useSettingsCliModel } from "~/ui/settings/useSettingsCliModel";
import { useSettingsDirectoriesModel } from "~/ui/settings/useSettingsDirectoriesModel";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const SettingsDev = () => {
	const cli = useSettingsCliModel();
	const directories = useSettingsDirectoriesModel();
	return (
		<section
			className="grid gap-3"
			data-ui="SettingsDev"
		>
			<SettingsOpenActionRow
				dataUi="SettingsCli"
				title="Command line"
				description={cli.cliDescription}
				pending={cli.cliPending}
				disabled={cli.cliDisabled}
				pendingLabel={cli.cliActionLabel}
				idleLabel={cli.cliActionLabel}
				onClick={cli.toggleCliInstallation}
			/>
			<SettingsOpenActionRow
				dataUi="SettingsCliCompletion"
				title="Shell completion"
				description={cli.cliCompletionDescription}
				pending={cli.cliCompletionPending}
				disabled={cli.cliCompletionDisabled}
				pendingLabel={cli.cliCompletionActionLabel}
				idleLabel={cli.cliCompletionActionLabel}
				onClick={cli.toggleCliCompletion}
			/>
			<SettingsOpenActionRow
				dataUi="SettingsDiagnostics"
				title="Diagnostics"
				description="Open the bounded rotating logs used to investigate crashes and broken gameplay sessions."
				pending={directories.diagnosticsStatus.kind === "pending"}
				pendingLabel="Opening…"
				idleLabel="Open logs"
				onClick={directories.openDiagnostics}
			/>
			<SettingsOpenActionRow
				dataUi="SettingsUserData"
				title="Application data"
				description="Open Arkini's data root containing editor projects, Arkpacks, saves, preferences, and logs."
				pending={directories.userDataStatus.kind === "pending"}
				pendingLabel="Opening…"
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
			{cli.cliStatus.kind === "error" ? (
				<p className="text-center text-sm text-danger">
					CLI installation failed: {cli.cliStatus.message}
				</p>
			) : null}
			{cli.cliCompletionStatus.kind === "error" ? (
				<p className="text-center text-sm text-danger">
					Shell completion failed: {cli.cliCompletionStatus.message}
				</p>
			) : null}
		</section>
	);
};
