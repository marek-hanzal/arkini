import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback, useMemo } from "react";

import { refreshEditorProjectCommandAtom } from "~/bridge/editor/refreshEditorProjectCommandAtom";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export namespace useEditorProjectRefreshController {
	export interface Props {
		readonly blocked: boolean;
		readonly projectId: string;
	}

	export interface Output {
		readonly disabled: boolean;
		readonly icon: string;
		readonly pending: boolean;
		readonly refresh: () => void;
		readonly tooltip: string;
	}
}

/** Owns hard-refresh command state; EditorShell only binds its presentation. */
export const useEditorProjectRefreshController = ({
	blocked,
	projectId,
}: useEditorProjectRefreshController.Props): useEditorProjectRefreshController.Output => {
	const commandAtom = refreshEditorProjectCommandAtom(projectId);
	const result = useAtomValue(commandAtom);
	const run = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const pending = result.waiting;
	const disabled = blocked || pending;
	const error = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const refresh = useCallback(() => {
		if (disabled) return;
		void run(undefined).catch(() => undefined);
	}, [
		disabled,
		run,
	]);

	return useMemo(
		() => ({
			disabled,
			icon: pending
				? "icon-[lucide--loader-circle] animate-spin"
				: "icon-[lucide--refresh-cw]",
			pending,
			refresh,
			tooltip:
				error === undefined
					? pending
						? "Refreshing from disk…"
						: "Refresh from disk"
					: `Refresh failed: ${message(error)}`,
		}),
		[
			disabled,
			error,
			pending,
			refresh,
		],
	);
};
