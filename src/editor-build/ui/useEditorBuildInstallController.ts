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
		readonly cancelInstallFn: () => void;
		readonly confirmInstallFn: () => void;
		readonly installAction: "install" | "update";
		readonly installArtifactFn: () => void;
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
	const runInstallFn = useAtomSet(installAtom, {
		mode: "promise",
	});
	const installError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(installResult));
	const installedPackageId =
		AsyncResult.isSuccess(installResult) && !installResult.waiting
			? installResult.value.packageId
			: undefined;
	const [requestedConfirmation, setRequestedConfirmationFn] =
		useState<EditorBuildMajorUpdateConfirmation>();
	const installConfirmation =
		requestedConfirmation?.targetContentHash === artifact?.contentHash
			? requestedConfirmation
			: undefined;

	const runArtifactInstallFn = async (confirmation?: EditorBuildMajorUpdateConfirmation) => {
		if (artifact === undefined) return;
		try {
			await runInstallFn({
				artifact,
				...(confirmation === undefined
					? {}
					: {
							confirmation,
						}),
				targetVersion,
			});
			if (confirmation !== undefined)
				setRequestedConfirmationFn((current) =>
					current === confirmation ? undefined : current,
				);
		} catch {
			// The settled command error remains visible in the Build output or confirmation.
		}
	};

	return {
		cancelInstallFn: () => {
			if (!installResult.waiting && installConfirmation !== undefined)
				setRequestedConfirmationFn((current) =>
					current === installConfirmation ? undefined : current,
				);
		},
		confirmInstallFn: () => {
			if (!installResult.waiting && installConfirmation !== undefined)
				void runArtifactInstallFn(installConfirmation);
		},
		installAction: installPlan?.action ?? "install",
		installArtifactFn: () => {
			if (installResult.waiting || installPlan === undefined) return;
			if (installPlan.confirmation !== undefined) {
				setRequestedConfirmationFn(installPlan.confirmation);
				return;
			}
			void runArtifactInstallFn();
		},
		installAvailable: installPlan !== undefined,
		installConfirmation,
		installError: readErrorMessageFn(installError),
		installPending: installResult.waiting,
		installedPackageId,
	};
};
