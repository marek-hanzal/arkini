import { useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import type { EditorBuildMajorUpdateConfirmation } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import { installBuiltEditorSerapackFx } from "~/editor-build/fx/installBuiltEditorSerapackFx";
import { prepareProjectGameFx } from "~/editor-build/fx/prepareProjectGameFx";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { SerapackCatalogOwnerAtom } from "~/serapack-catalog/atom/SerapackCatalogOwnerAtom";

interface PendingMajorUpdate {
	readonly artifact: EditorProjectBuildSchema.Type;
	readonly confirmation: EditorBuildMajorUpdateConfirmation;
}

/** Owns Play's build, exact package publication, confirmation, and navigation. */
export const useYourGamesPlayController = (externallyBlocked: boolean) => {
	const catalog = useAtomValue(SerapackCatalogOwnerAtom);
	const navigateFn = useNavigate();
	const mountedRef = useRef(false);
	const pendingRef = useRef(false);
	const [pendingProjectId, setPendingProjectIdFn] = useState<string>();
	const [majorUpdate, setMajorUpdateFn] = useState<PendingMajorUpdate>();
	const [error, setErrorFn] = useState<unknown>();

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const playProjectFn = async (projectId: string) => {
		if (externallyBlocked || pendingRef.current || majorUpdate !== undefined) return;
		pendingRef.current = true;
		setPendingProjectIdFn(projectId);
		setErrorFn(undefined);
		try {
			if (catalog === undefined) throw new Error("Serapack catalog is not configured.");
			const prepared = await RendererRuntime.runPromise(
				prepareProjectGameFx(projectId, catalog),
			);
			if (prepared.type === "confirmation") {
				if (mountedRef.current) setMajorUpdateFn(prepared);
				return;
			}
			await navigateFn({
				to: "/action/load-game/$packageId",
				params: {
					packageId: prepared.packageId,
				},
			});
		} catch (cause) {
			if (mountedRef.current) setErrorFn(cause);
		} finally {
			pendingRef.current = false;
			if (mountedRef.current) setPendingProjectIdFn(undefined);
		}
	};

	const confirmMajorUpdateFn = async () => {
		if (catalog === undefined || majorUpdate === undefined || pendingRef.current) return;
		pendingRef.current = true;
		setPendingProjectIdFn(majorUpdate.artifact.projectId);
		setErrorFn(undefined);
		try {
			const installed = await RendererRuntime.runPromise(
				installBuiltEditorSerapackFx({
					artifact: majorUpdate.artifact,
					catalog,
					confirmation: majorUpdate.confirmation,
				}),
			);
			if (mountedRef.current) setMajorUpdateFn(undefined);
			await navigateFn({
				to: "/action/load-game/$packageId",
				params: {
					packageId: installed.packageId,
				},
			});
		} catch (cause) {
			if (mountedRef.current) setErrorFn(cause);
		} finally {
			pendingRef.current = false;
			if (mountedRef.current) setPendingProjectIdFn(undefined);
		}
	};

	return {
		blocked: pendingProjectId !== undefined || majorUpdate !== undefined,
		cancelMajorUpdateFn: () => {
			if (pendingRef.current) return;
			setMajorUpdateFn(undefined);
			setErrorFn(undefined);
		},
		confirmMajorUpdateFn,
		error,
		majorUpdate,
		pendingProjectId,
		playProjectFn,
	};
};
