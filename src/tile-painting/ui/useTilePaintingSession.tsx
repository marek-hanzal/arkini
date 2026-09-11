import {
	createContext,
	useContext,
	useState,
	useMemo,
	useEffect,
	useSyncExternalStore,
	type PropsWithChildren,
} from "react";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import {
	useEditorUnsavedChangesRegistration,
	useEditorUnsavedChangesOwner,
} from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { TilePaintingDocumentSchema } from "~/tile-painting/schema/TilePaintingDocumentSchema";
import type { TilePaintingSchema } from "~/tile-painting/schema/TilePaintingSchema";
import { makeTilePaintingSessionFx } from "~/tile-painting/fx/makeTilePaintingSessionFx";
import type { ResourceSchema } from "~/game-config-resource/schema/ResourceSchema";

export namespace useTilePaintingSession {
	export interface Output extends makeTilePaintingSessionFx.UiSnapshot {
		readonly editFn: (document: TilePaintingDocumentSchema.Type) => void;
		readonly undoFn: () => void;
		readonly redoFn: () => void;
		readonly saveFn: (outputResourceId?: string) => Promise<boolean>;
		readonly addImageFn: (
			source: ResourceSchema.Type,
			applyFn: (
				document: TilePaintingDocumentSchema.Type,
				imageId: string,
			) => TilePaintingDocumentSchema.Type,
		) => Promise<boolean>;
		readonly setViewFn: (view: makeTilePaintingSessionFx.View) => void;
		readonly setPaintAllLayersFn: (all: boolean) => void;
		readonly setActiveLayerIdFn: (id: string | null) => void;
		readonly setToolFn: (tool: makeTilePaintingSessionFx.UiSnapshot["tool"]) => void;
		readonly setBrushFn: (brush: makeTilePaintingSessionFx.Brush) => void;
		readonly setScatterSpacingFn: (spacing: number) => void;
		readonly setPreviewOpacityFn: (opacity: number) => void;
		readonly setReferenceOnlyFn: (only: boolean) => void;
		readonly setErrorFn: (message: string | null) => void;
	}
}

const TilePaintingSessionContext = createContext<makeTilePaintingSessionFx.Output | null>(null);

/** Keeps one imperative session alive above replaceable routed tab pages. */
export const TilePaintingSessionProvider = ({
	loaded,
	children,
}: PropsWithChildren<{
	readonly loaded: TilePaintingSchema.Type;
}>) => {
	const project = useEditorProject();
	const unsavedOwner = useEditorUnsavedChangesOwner();
	const [runtime] = useState(() =>
		RendererRuntime.runSync(
			makeTilePaintingSessionFx({
				loaded,
				project,
			}),
		),
	);
	useEffect(() => {
		RendererRuntime.runSync(runtime.activateFx);
		return () => {
			RendererRuntime.runSync(runtime.closeFx);
		};
	}, [
		runtime,
	]);
	useEffect(() => {
		let previous = runtime.readSessionFn();
		return runtime.subscribeFn(() => {
			const next = runtime.readSessionFn();
			if (next === previous) return;
			previous = next;
			unsavedOwner.refreshFn();
		});
	}, [
		runtime,
		unsavedOwner,
	]);
	useEditorUnsavedChangesRegistration({
		id: `tile-painting:${loaded.projectId}:${loaded.paintingId}`,
		isDirtyFn: () => runtime.readFn().dirty,
		isValidFn: () =>
			!runtime.readFn().busy &&
			TilePaintingDocumentSchema.safeParse(runtime.readFn().document).success,
		discardFn: () => RendererRuntime.runSync(runtime.discardFx),
		saveFn: () => RendererRuntime.runPromise(runtime.saveFx()),
		ownsPathnameFn: (pathname) => {
			const prefix = `/editor/${encodeURIComponent(loaded.projectId)}/painter/${encodeURIComponent(loaded.paintingId)}`;
			return pathname === prefix || pathname.startsWith(`${prefix}/`);
		},
	});
	return <TilePaintingSessionContext value={runtime}>{children}</TilePaintingSessionContext>;
};

export const useTilePaintingSessionRuntime = (): makeTilePaintingSessionFx.Output => {
	const runtime = useContext(TilePaintingSessionContext);
	if (runtime === null) throw new Error("Tile painting session is missing.");
	return runtime;
};

/** React renders a stable projection; commands settle in the owner before they return. */
export const useTilePaintingSession = (): useTilePaintingSession.Output => {
	const runtime = useTilePaintingSessionRuntime();
	const snapshot = useSyncExternalStore(
		runtime.subscribeFn,
		runtime.readSessionFn,
		runtime.readSessionFn,
	);
	const commands = useMemo(
		() => ({
			editFn: (document: TilePaintingDocumentSchema.Type) =>
				RendererRuntime.runSync(runtime.editFx(document)),
			undoFn: () => RendererRuntime.runSync(runtime.undoFx),
			redoFn: () => RendererRuntime.runSync(runtime.redoFx),
			saveFn: (outputResourceId?: string) =>
				RendererRuntime.runPromise(runtime.saveFx(outputResourceId)),
			addImageFn: (
				source: ResourceSchema.Type,
				applyFn: (
					document: TilePaintingDocumentSchema.Type,
					imageId: string,
				) => TilePaintingDocumentSchema.Type,
			) => RendererRuntime.runPromise(runtime.addImageFx(source, applyFn)),
			setViewFn: (view: makeTilePaintingSessionFx.View) =>
				RendererRuntime.runSync(runtime.setViewFx(view)),
			setActiveLayerIdFn: (id: string | null) =>
				RendererRuntime.runSync(runtime.setActiveLayerIdFx(id)),
			setPaintAllLayersFn: (all: boolean) =>
				RendererRuntime.runSync(runtime.setPaintAllLayersFx(all)),
			setToolFn: (tool: makeTilePaintingSessionFx.UiSnapshot["tool"]) =>
				RendererRuntime.runSync(runtime.setToolFx(tool)),
			setBrushFn: (brush: makeTilePaintingSessionFx.Brush) =>
				RendererRuntime.runSync(runtime.setBrushFx(brush)),
			setScatterSpacingFn: (spacing: number) =>
				RendererRuntime.runSync(runtime.setScatterSpacingFx(spacing)),
			setPreviewOpacityFn: (opacity: number) =>
				RendererRuntime.runSync(runtime.setPreviewOpacityFx(opacity)),
			setReferenceOnlyFn: (only: boolean) =>
				RendererRuntime.runSync(runtime.setReferenceOnlyFx(only)),
			setErrorFn: (message: string | null) =>
				RendererRuntime.runSync(runtime.setErrorFx(message)),
		}),
		[
			runtime,
		],
	);
	return useMemo(
		() => ({
			...snapshot,
			...commands,
		}),
		[
			snapshot,
			commands,
		],
	);
};
