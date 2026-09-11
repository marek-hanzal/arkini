import type { EditorBuildMajorUpdateConfirmation } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import type { Project } from "~/project-authoring/type/Project";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { GameDiagnosticSchema } from "~/game-config-diagnostic/schema/GameDiagnosticSchema";
import {
	type EditorBuildFailure,
	useEditorBuildArtifactController,
} from "./useEditorBuildArtifactController";
import { useEditorBuildInstallController } from "./useEditorBuildInstallController";
import { useEditorBuildSaveController } from "./useEditorBuildSaveController";
import { useState } from "react";
import { VersionPartsSchema } from "~/game-version/schema/VersionPartsSchema";

type EditorBuildStatus = "building" | "not-built" | "stale" | "valid";

export namespace useEditorBuildController {
	export interface Output {
		readonly artifact?: EditorProjectBuildSchema.Type;
		readonly buildFn: () => void;
		readonly buildFailure?: EditorBuildFailure;
		readonly buildPending: boolean;
		readonly buildStatus: EditorBuildStatus;
		readonly canBuild: boolean;
		readonly cancelInstallFn: () => void;
		readonly confirmInstallFn: () => void;
		readonly dismissValidationFn: () => void;
		readonly diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>;
		readonly installAction: "install" | "update";
		readonly installArtifactFn: () => void;
		readonly installAvailable: boolean;
		readonly installConfirmation?: EditorBuildMajorUpdateConfirmation;
		readonly installError?: string;
		readonly installPending: boolean;
		readonly installedPackageId?: string;
		readonly project: Project;
		readonly version: VersionPartsSchema.Type;
		readonly versionError?: string;
		readonly setMajorFn: (value: number) => void;
		readonly setMinorFn: (value: number) => void;
		readonly setSuffixFn: (value: string) => void;
		readonly saveArtifactFn: () => void;
		readonly saveError?: string;
		readonly savePending: boolean;
		readonly validationVisible: boolean;
	}
}

/** Composes build, external save, and installation without duplicating artifact truth. */
export const useEditorBuildController = (): useEditorBuildController.Output => {
	const project = useEditorProject();
	const [draft, setDraftFn] = useState({
		projectId: project.projectId,
		version: project.version,
	});
	const version = draft.projectId === project.projectId ? draft.version : project.version;
	if (draft.projectId !== project.projectId)
		setDraftFn({
			projectId: project.projectId,
			version: project.version,
		});
	const validated = VersionPartsSchema.safeParse(version);
	const canBuild = validated.success;
	const artifactController = useEditorBuildArtifactController({
		canBuild,
		version,
		project,
	});
	const saveController = useEditorBuildSaveController({
		artifact: artifactController.artifact,
	});
	const installController = useEditorBuildInstallController({
		artifact: artifactController.artifact,
	});

	return {
		artifact: artifactController.artifact,
		buildFn: artifactController.buildFn,
		buildFailure: artifactController.buildFailure,
		buildPending: artifactController.buildPending,
		buildStatus: artifactController.buildStatus,
		canBuild,
		cancelInstallFn: installController.cancelInstallFn,
		confirmInstallFn: installController.confirmInstallFn,
		dismissValidationFn: artifactController.dismissValidationFn,
		diagnostics: artifactController.diagnostics,
		installAction: installController.installAction,
		installArtifactFn: installController.installArtifactFn,
		installAvailable: installController.installAvailable,
		installConfirmation: installController.installConfirmation,
		installError: installController.installError,
		installPending: installController.installPending,
		installedPackageId: installController.installedPackageId,

		project,
		saveArtifactFn: saveController.saveArtifactFn,
		saveError: saveController.saveError,
		savePending: saveController.savePending,
		validationVisible: artifactController.validationVisible,
		version,
		versionError: validated.success
			? undefined
			: "Use non-negative whole numbers and an optional suffix containing letters, digits, dots or hyphens.",
		setMajorFn: (major) =>
			setDraftFn({
				projectId: project.projectId,
				version: {
					...version,
					major,
				},
			}),
		setMinorFn: (minor) =>
			setDraftFn({
				projectId: project.projectId,
				version: {
					...version,
					minor,
				},
			}),
		setSuffixFn: (suffix) =>
			setDraftFn({
				projectId: project.projectId,
				version: {
					major: version.major,
					minor: version.minor,
					...(suffix === ""
						? {}
						: {
								suffix,
							}),
				},
			}),
	};
};
