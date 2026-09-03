import { LoaderCircle, PackageCheck, TriangleAlert } from "lucide-react";

import type { EditorBuildFailure } from "~/editor-build/ui/useEditorBuildArtifactController";
import { PrimaryButton } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";

interface EditorBuildStatusProps {
	readonly buildFailure: EditorBuildFailure | undefined;
	readonly canBuild: boolean;
	readonly pending: boolean;
	readonly stale: boolean;
	readonly version: string;
	readonly versionStatusError: string | undefined;
	readonly onBuildFn: () => void;
}

/** Presents the one next Build action or its current blocking state. */
export const EditorBuildStatus = ({
	buildFailure,
	canBuild,
	pending,
	stale,
	version,
	versionStatusError,
	onBuildFn,
}: EditorBuildStatusProps) => {
	if (versionStatusError !== undefined) {
		return (
			<Status
				dataUi="EditorBuildActionStatus"
				description={versionStatusError}
				icon={TriangleAlert}
				title="Build unavailable"
			/>
		);
	}

	if (pending) {
		return (
			<Status
				dataUi="EditorBuildActionStatus"
				description="Validating the committed project and creating its Arkpack."
				icon={LoaderCircle}
				iconSpin
				title={`Building Version v${version}`}
			/>
		);
	}

	if (buildFailure?.type === "validation") {
		return (
			<Status
				action={
					<PrimaryButton
						className="gap-2"
						disabled={!canBuild}
						onClick={onBuildFn}
					>
						<PackageCheck className="size-4" />
						Try again
					</PrimaryButton>
				}
				dataUi="EditorBuildActionStatus"
				description={`Fix the blocking findings below, commit the project, then build Version v${version} again.`}
				icon={TriangleAlert}
				title="Build blocked by validation"
			/>
		);
	}

	if (buildFailure?.type === "operational") {
		return (
			<Status
				action={
					<PrimaryButton
						className="gap-2"
						disabled={!canBuild}
						onClick={onBuildFn}
					>
						<PackageCheck className="size-4" />
						Try again
					</PrimaryButton>
				}
				dataUi="EditorBuildActionStatus"
				description={
					buildFailure.detail ??
					"The Editor project could not be built because of an unknown error."
				}
				icon={TriangleAlert}
				title="Build failed"
			/>
		);
	}

	return (
		<Status
			action={
				<PrimaryButton
					className="gap-2"
					disabled={!canBuild}
					onClick={onBuildFn}
				>
					<PackageCheck className="size-4" />
					Build
				</PrimaryButton>
			}
			dataUi="EditorBuildActionStatus"
			description={
				stale
					? `The previous Build is out of date. Build Version v${version} to replace it.`
					: `Validate Version v${version} and create an Arkpack ready to install or save.`
			}
			icon={PackageCheck}
			title={stale ? `Build current Version v${version}` : `Build Version v${version}`}
		/>
	);
};
