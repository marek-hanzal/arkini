import { useAtomSet } from "@effect/atom-react";
import { useRouter } from "@tanstack/react-router";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useEffect, useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { ArkpackCatalogOwnerAtom } from "~/arkpack-catalog/atom/ArkpackCatalogOwnerAtom";
import { useEditorProjectRefreshController } from "~/authoring-session/ui/useEditorProjectRefreshController";
import { useEditorUnsavedChangesOwner } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";

const waitForEditorProjectWritesCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
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
			readonly close: () => void;
			readonly disabled: boolean;
			readonly pending: boolean;
		};
		readonly refresh: {
			readonly disabled: boolean;
			readonly pending: boolean;
			readonly refresh: () => void;
			readonly tooltip: string;
		};
	}
}

/** Coordinates mutually exclusive project refresh and controlled Editor exit commands. */
export const useEditorShellCommands = ({
	projectId,
}: useEditorShellCommands.Props): useEditorShellCommands.Output => {
	const owner = useEditorUnsavedChangesOwner();
	const router = useRouter();
	const waitForProjectWrites = useAtomSet(waitForEditorProjectWritesCommandAtom, {
		mode: "promise",
	});
	const [exitPending, setExitPending] = useState(false);
	const refresh = useEditorProjectRefreshController({
		blocked: exitPending,
		projectId,
	});

	useEffect(() => window.arkini.lifecycle.onCloseFailed(() => setExitPending(false)), []);

	const close = async () => {
		if (exitPending || refresh.pending) return;
		setExitPending(true);
		try {
			if (!(await owner.requestLeave("/main-menu"))) {
				setExitPending(false);
				return;
			}
			await waitForProjectWrites(undefined);
			await router.navigate({
				to: "/main-menu",
			});
		} catch {
			setExitPending(false);
		}
	};

	return {
		exit: {
			close: () => void close(),
			disabled: exitPending || refresh.pending,
			pending: exitPending,
		},
		refresh: {
			disabled: refresh.disabled,
			pending: refresh.pending,
			refresh: refresh.refresh,
			tooltip: refresh.tooltip,
		},
	};
};
