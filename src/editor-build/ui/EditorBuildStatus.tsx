import type { ReactNode } from "react";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
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
	const translator = useTranslator();
	const requestedVersion = canBuild ? formatVersionFn(version) : "…";
	let title = `${translator.textFn(stale ? "Build current project" : "Build")} v${requestedVersion}`;
	let description: ReactNode = (
		<Mx label={stale ? "Build stale description" : "Build ready description"} />
	);
	let icon = PackageCheck;
	if (!pending && buildFailure?.type === "validation") {
		title = translator.textFn("Build blocked by validation");
		description = <Mx label="Build validation blocked description" />;
		icon = TriangleAlert;
	} else if (!pending && buildFailure?.type === "operational") {
		title = translator.textFn("Build failed");
		description =
			buildFailure.detail ??
			translator.textFn("An unexpected error prevented the build. Try again.");
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
								label={translator.textFn("Major")}
								min={0}
								max={Number.MAX_SAFE_INTEGER}
								value={version.major}
								onChangeFn={onMajorChangeFn}
							/>
							<span className="pb-2">.</span>
							<EditorNumberControl
								label={translator.textFn("Minor")}
								min={0}
								max={Number.MAX_SAFE_INTEGER}
								value={version.minor}
								onChangeFn={onMinorChangeFn}
							/>
							<span className="pb-2">-</span>
							<EditorTextControl
								label={translator.textFn("Suffix")}
								required={false}
								placeholder={translator.textFn("Optional")}
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
						<Tx label={buildFailure === undefined || pending ? "Build" : "Try again"} />
					</PrimaryButton>
				</div>
			}
			dataUi="EditorBuildActionStatus"
			description={description}
			icon={icon}
			title={title}
			variant="flat"
		/>
	);
};
