import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useState } from "react";

import { CatalogAtom } from "~/arkpack-catalog/atom/CatalogAtom";
import {
	type EditorBuildMajorUpdateConfirmation,
	readEditorBuildInstallPlanFn,
} from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { BuildCommandAtoms } from "~/editor-build/atom/BuildCommandAtoms";

const readErrorMessageFn = (error: unknown) =>
	error === undefined ? undefined : error instanceof Error ? error.message : String(error);

export namespace useEditorBuildInstallController {
	export interface Props {
		readonly artifact?: EditorProjectBuildSchema.Type;
		readonly targetVersion: GameVersionSchema.Type;
	}

	export interface Output {
		readonly cancelInstall: () => void;
		readonly confirmInstall: () => void;
		readonly installAction: "install" | "update";
		readonly installArtifact: () => void;
		readonly installAvailable: boolean;
		readonly installConfirmation?: EditorBuildMajorUpdateConfirmation;
		readonly installError?: string;
		readonly installPending: boolean;
		readonly installedPackageId?: string;
	}
}

/** Owns catalog-aware installation and confirmation for one exact admitted build artifact. */
export const useEditorBuildInstallController = ({
	artifact,
	targetVersion,
}: useEditorBuildInstallController.Props): useEditorBuildInstallController.Output => {
	const catalogState = useAtomValue(CatalogAtom);
	const installPlan =
		artifact !== undefined && catalogState.type === "ready"
			? readEditorBuildInstallPlanFn({
					arkpacks: catalogState.arkpacks,
					artifact,
					targetVersion,
				})
			: undefined;
	const installAtom = BuildCommandAtoms.install(artifact?.contentHash ?? "unbuilt");
	const installResult = useAtomValue(installAtom);
	const runInstall = useAtomSet(installAtom, {
		mode: "promise",
	});
	const installError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(installResult));
	const installedPackageId =
		AsyncResult.isSuccess(installResult) && !installResult.waiting
			? installResult.value.packageId
			: undefined;
	const [requestedConfirmation, setRequestedConfirmation] =
		useState<EditorBuildMajorUpdateConfirmation>();
	const installConfirmation =
		requestedConfirmation?.targetContentHash === artifact?.contentHash
			? requestedConfirmation
			: undefined;

	const runArtifactInstall = async (confirmation?: EditorBuildMajorUpdateConfirmation) => {
		if (artifact === undefined) return;
		try {
			await runInstall({
				artifact,
				...(confirmation === undefined
					? {}
					: {
							confirmation,
						}),
				targetVersion,
			});
			if (confirmation !== undefined)
				setRequestedConfirmation((current) =>
					current === confirmation ? undefined : current,
				);
		} catch {
			// The settled command error remains visible in the Build output or confirmation.
		}
	};

	return {
		cancelInstall: () => {
			if (!installResult.waiting && installConfirmation !== undefined)
				setRequestedConfirmation((current) =>
					current === installConfirmation ? undefined : current,
				);
		},
		confirmInstall: () => {
			if (!installResult.waiting && installConfirmation !== undefined)
				void runArtifactInstall(installConfirmation);
		},
		installAction: installPlan?.action ?? "install",
		installArtifact: () => {
			if (installResult.waiting || installPlan === undefined) return;
			if (installPlan.confirmation !== undefined) {
				setRequestedConfirmation(installPlan.confirmation);
				return;
			}
			void runArtifactInstall();
		},
		installAvailable: installPlan !== undefined,
		installConfirmation,
		installError: readErrorMessageFn(installError),
		installPending: installResult.waiting,
		installedPackageId,
	};
};
