import { useAtomSet } from "@effect/atom-react";
import { useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useEffect, useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { ArkpackCatalogOwnerAtom } from "~/arkpack-catalog/atom/ArkpackCatalogOwnerAtom";
import { useEditorProjectRefreshController } from "~/authoring-session/ui/useEditorProjectRefreshController";
import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";

const waitForEditorProjectWritesCommandAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.fn((_, get) => {
			const catalog = get(ArkpackCatalogOwnerAtom);
			return Effect.all([
				repository.awaitIdleFx,
				catalog?.awaitIdleFx ?? Effect.void,
			]).pipe(Effect.asVoid);
		}).pipe(Atom.setIdleTTL(0)),
	),
);

export namespace useEditorShellCommands {
	export interface Props {
		readonly projectId: string;
	}

	export interface Output {
		readonly exit: {
			readonly closeFn: () => void;
			readonly disabled: boolean;
			readonly pending: boolean;
		};
		readonly refresh: {
			readonly disabled: boolean;
			readonly pending: boolean;
			readonly refreshFn: () => void;
			readonly tooltip: string;
		};
	}
}

/** Coordinates mutually exclusive project refresh and controlled Editor exit commands. */
export const useEditorShellCommands = ({
	projectId,
}: useEditorShellCommands.Props): useEditorShellCommands.Output => {
	const owner = useEditorUnsavedChangesOwner();
	const writeAdmission = RendererRuntime.runSync(ProjectWriteAdmission);
	const router = useRouter();
	const waitForProjectWritesFn = useAtomSet(waitForEditorProjectWritesCommandAtom, {
		mode: "promise",
	});
	const [exitPending, setExitPendingFn] = useState(false);
	const refresh = useEditorProjectRefreshController({
		blocked: exitPending,
		projectId,
	});

	useEffect(() => window.arkini.lifecycle.onCloseFailedFn(() => setExitPendingFn(false)), []);

	const closeFn = async () => {
		if (exitPending || refresh.pending || writeAdmission.isNavigationBlockedFn()) return;
		setExitPendingFn(true);
		try {
			if (!(await owner.requestLeaveFn("/main-menu"))) return;
			await waitForProjectWritesFn(undefined);
			if (writeAdmission.isNavigationBlockedFn()) return;
			void router
				.navigate({
					to: "/main-menu",
				})
				.catch(() => undefined);
		} catch {
			// A failed write wait leaves the Editor available for another exit attempt.
		} finally {
			setExitPendingFn(false);
		}
	};

	return {
		exit: {
			closeFn: () => void closeFn(),
			disabled: exitPending || refresh.pending,
			pending: exitPending,
		},
		refresh: {
			disabled: refresh.disabled,
			pending: refresh.pending,
			refreshFn: refresh.refreshFn,
			tooltip: refresh.tooltip,
		},
	};
};
