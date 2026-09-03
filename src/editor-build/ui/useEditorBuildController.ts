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
import { useProjectVersionStatus } from "~/project-version/ui/useProjectVersionStatus";

type EditorBuildStatus = "building" | "not-built" | "stale" | "valid";

export namespace useEditorBuildController {
	export interface Output {
		readonly artifact?: EditorProjectBuildSchema.Type;
		readonly buildFn: () => void;
		readonly buildFailure?: EditorBuildFailure;
		readonly buildPending: boolean;
		readonly buildStatus: EditorBuildStatus;
		readonly canBuild: boolean;
		readonly commitRequired?: boolean;
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
		readonly versionStatusError?: string;
		readonly saveArtifactFn: () => void;
		readonly saveError?: string;
		readonly savePending: boolean;
		readonly validationVisible: boolean;
	}
}

/** Composes build, external save, and installation without duplicating artifact truth. */
export const useEditorBuildController = (): useEditorBuildController.Output => {
	const project = useEditorProject();
	const versionState = useProjectVersionStatus(project.projectId);
	const versionStatus = versionState.status === "ready" ? versionState.versionStatus : undefined;
	const canBuild =
		versionStatus?.currentBaseVersionId !== undefined && versionStatus.dirty === false;
	const artifactController = useEditorBuildArtifactController({
		canBuild,
		project,
	});
	const saveController = useEditorBuildSaveController({
		artifact: artifactController.artifact,
	});
	const installController = useEditorBuildInstallController({
		artifact: artifactController.artifact,
		targetVersion: project.version,
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
		...(versionStatus === undefined
			? {}
			: {
					commitRequired:
						versionStatus.currentBaseVersionId === undefined || versionStatus.dirty,
				}),
		project,
		saveArtifactFn: saveController.saveArtifactFn,
		saveError: saveController.saveError,
		savePending: saveController.savePending,
		validationVisible: artifactController.validationVisible,
		...(versionState.status === "error"
			? {
					versionStatusError: versionState.message,
				}
			: {}),
	};
};
