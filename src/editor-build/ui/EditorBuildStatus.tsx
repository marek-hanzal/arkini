import { LoaderCircle, PackageCheck, TriangleAlert } from "lucide-react";

import type { EditorBuildFailure } from "~/editor-build/ui/useEditorBuildArtifactController";
import { EditorFormCard } from "~/editor-control/ui/EditorFormCard";
import { EditorNumberControl, EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { formatVersionFn } from "~/game-version/fn/formatVersionFn";
import type { VersionPartsSchema } from "~/game-version/schema/VersionPartsSchema";
import { PrimaryButton } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";

interface EditorBuildStatusProps {
	readonly buildFailure: EditorBuildFailure | undefined;
	readonly canBuild: boolean;
	readonly pending: boolean;
	readonly stale: boolean;
	readonly version: VersionPartsSchema.Type;
	readonly versionError: string | undefined;
	readonly onBuildFn: () => void;
	readonly onMajorChangeFn: (value: number) => void;
	readonly onMinorChangeFn: (value: number) => void;
	readonly onSuffixChangeFn: (value: string) => void;
}

/** Keeps the outgoing version beside its Build action and current status. */
export const EditorBuildStatus = ({
	buildFailure,
	canBuild,
	pending,
	stale,
	version,
	versionError,
	onBuildFn,
	onMajorChangeFn,
	onMinorChangeFn,
	onSuffixChangeFn,
}: EditorBuildStatusProps) => {
	const requestedVersion = canBuild ? formatVersionFn(version) : "…";
	let title = stale ? `Build current project v${requestedVersion}` : `Build v${requestedVersion}`;
	let description = stale
		? `The previous Build is out of date. Build v${requestedVersion} to replace it.`
		: "Validate the saved project and create an Arkpack ready to install or save.";
	let icon = PackageCheck;
	if (pending) {
		title = `Building v${requestedVersion}`;
		description = "Validating the saved project and creating its Arkpack.";
	} else if (buildFailure?.type === "validation") {
		title = "Build blocked by validation";
		description = `Fix the blocking findings below, then build v${requestedVersion} again.`;
		icon = TriangleAlert;
	} else if (buildFailure?.type === "operational") {
		title = "Build failed";
		description =
			buildFailure.detail ??
			"The Editor project could not be built because of an unknown error.";
		icon = TriangleAlert;
	}

	return (
		<Status
			action={
				<div className="grid justify-items-center gap-4">
					<EditorFormCard>
						<fieldset
							disabled={pending}
							className="grid grid-cols-[minmax(0,6rem)_auto_minmax(0,6rem)_auto_minmax(0,12rem)] items-end gap-2 text-left"
							data-ui="EditorBuildVersion"
						>
							<EditorNumberControl
								label="Major"
								min={0}
								max={Number.MAX_SAFE_INTEGER}
								value={version.major}
								onChangeFn={onMajorChangeFn}
							/>
							<span className="pb-2">.</span>
							<EditorNumberControl
								label="Minor"
								min={0}
								max={Number.MAX_SAFE_INTEGER}
								value={version.minor}
								onChangeFn={onMinorChangeFn}
							/>
							<span className="pb-2">-</span>
							<EditorTextControl
								label="Suffix"
								required={false}
								placeholder="optional"
								value={version.suffix ?? ""}
								onChangeFn={onSuffixChangeFn}
							/>
						</fieldset>
						{versionError === undefined ? null : (
							<p className="text-left text-sm text-danger">{versionError}</p>
						)}
					</EditorFormCard>
					<PrimaryButton
						className="gap-2"
						disabled={pending || !canBuild}
						onClick={onBuildFn}
					>
						{pending ? (
							<LoaderCircle className="size-4 animate-spin" />
						) : (
							<PackageCheck className="size-4" />
						)}
						{buildFailure === undefined || pending ? "Build" : "Try again"}
					</PrimaryButton>
				</div>
			}
			dataUi="EditorBuildActionStatus"
			description={description}
			icon={icon}
			title={title}
		/>
	);
};
