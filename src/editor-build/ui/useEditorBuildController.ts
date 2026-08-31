import type { EditorBuildMajorUpdateConfirmation } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { GameDiagnosticSchema } from "~/game-config-diagnostic/schema/GameDiagnosticSchema";
import {
	type EditorBuildFailure,
	useEditorBuildArtifactController,
} from "./useEditorBuildArtifactController";
import { useEditorBuildInstallController } from "./useEditorBuildInstallController";
import { useEditorBuildSaveController } from "./useEditorBuildSaveController";

type EditorBuildStatus = "building" | "not-built" | "stale" | "valid";

export namespace useEditorBuildController {
	export interface Output {
		readonly artifact?: EditorProjectBuildSchema.Type;
		readonly build: () => void;
		readonly buildFailure?: EditorBuildFailure;
		readonly buildPending: boolean;
		readonly buildStatus: EditorBuildStatus;
		readonly cancelInstall: () => void;
		readonly confirmInstall: () => void;
		readonly diagnostics: ReadonlyArray<GameDiagnosticSchema.Type>;
		readonly installAction: "install" | "update";
		readonly installArtifact: () => void;
		readonly installAvailable: boolean;
		readonly installConfirmation?: EditorBuildMajorUpdateConfirmation;
		readonly installError?: string;
		readonly installPending: boolean;
		readonly installedPackageId?: string;
		readonly project: EditorProject;
		readonly saveArtifact: () => void;
		readonly saveError?: string;
		readonly savePending: boolean;
	}
}

/** Composes build, external save, and installation without duplicating artifact truth. */
export const useEditorBuildController = (): useEditorBuildController.Output => {
	const project = useEditorProject();
	const artifactController = useEditorBuildArtifactController({
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
		build: artifactController.build,
		buildFailure: artifactController.buildFailure,
		buildPending: artifactController.buildPending,
		buildStatus: artifactController.buildStatus,
		cancelInstall: installController.cancelInstall,
		confirmInstall: installController.confirmInstall,
		diagnostics: artifactController.diagnostics,
		installAction: installController.installAction,
		installArtifact: installController.installArtifact,
		installAvailable: installController.installAvailable,
		installConfirmation: installController.installConfirmation,
		installError: installController.installError,
		installPending: installController.installPending,
		installedPackageId: installController.installedPackageId,
		project,
		saveArtifact: saveController.saveArtifact,
		saveError: saveController.saveError,
		savePending: saveController.savePending,
	};
};
