import { Effect } from "effect";
import type { createTilePaintingTraceFx } from "~/tile-painting/fx/createTilePaintingTraceFx";

export namespace attachTilePaintingCaptureTraceFx {
	export interface Props {
		readonly viewportElement: HTMLDivElement;
		readonly canvas: HTMLCanvasElement;
		readonly trace: createTilePaintingTraceFx.Output;
	}
	export interface Output {
		readonly setCaptureFx: (pointerId: number, reason: string) => Effect.Effect<void>;
		readonly releaseCaptureFx: (pointerId: number, reason: string) => Effect.Effect<void>;
	}
}

/** Capture evidence owns no gesture decisions and leaves native event propagation untouched. */
export const attachTilePaintingCaptureTraceFx = (props: attachTilePaintingCaptureTraceFx.Props) =>
	Effect.acquireRelease(
		Effect.sync(() => {
			const { viewportElement, canvas, trace } = props;
			const recordFn = (event: string, data: unknown) =>
				Effect.runSync(trace.recordFx(event, data));
			const nodeIds = new WeakMap<EventTarget, number>();
			let nodeSequence = 0;
			let pointerId: number | undefined;
			const describeFn = (target: EventTarget | null) => {
				if (target === null) return null;
				let nodeId = nodeIds.get(target);
				if (nodeId === undefined) {
					nodeId = ++nodeSequence;
					nodeIds.set(target, nodeId);
				}
				return {
					nodeId,
					kind:
						target === window
							? "window"
							: target === document
								? "document"
								: target instanceof Element
									? target.tagName
									: "other",
					dataUi: target instanceof Element ? target.getAttribute("data-ui") : null,
					connected: target instanceof Node ? target.isConnected : null,
				};
			};
			const stateFn = () => ({
				pointerId: pointerId ?? null,
				captured: pointerId !== undefined && viewportElement.hasPointerCapture(pointerId),
				viewport: describeFn(viewportElement),
				canvas: describeFn(canvas),
				viewportParent: describeFn(viewportElement.parentNode),
				canvasParent: describeFn(canvas.parentNode),
				canvasInViewport: viewportElement.contains(canvas),
				focused: document.hasFocus(),
				visibility: document.visibilityState,
				activeElement: describeFn(document.activeElement),
				pointerLockElement: describeFn(document.pointerLockElement ?? null),
			});
			let ancestors = new Set<Node>();
			const readAncestorsFn = () => {
				ancestors = new Set<Node>();
				for (const surface of [
					viewportElement,
					canvas,
				])
					for (let node: Node | null = surface; node !== null; node = node.parentNode)
						ancestors.add(node);
			};
			readAncestorsFn();
			const mutationsFn = (records: MutationRecord[]) => {
				for (const record of records) {
					const affectsSurfaceFn = (node: Node) =>
						ancestors.has(node) ||
						node.contains(viewportElement) ||
						node.contains(canvas);
					const removed = Array.from(record.removedNodes).filter(affectsSurfaceFn);
					const added = Array.from(record.addedNodes).filter(affectsSurfaceFn);
					if (removed.length === 0 && added.length === 0) continue;
					recordFn("capture-dom-change", {
						target: describeFn(record.target),
						removed: removed.slice(0, 8).map(describeFn),
						added: added.slice(0, 8).map(describeFn),
						...stateFn(),
					});
				}
				readAncestorsFn();
			};
			const observer = new MutationObserver(mutationsFn);
			observer.observe(document, {
				childList: true,
				subtree: true,
			});
			// Drain before input/capture records: a detach and reinsert in the same task
			// must remain visible even if isConnected is already true at event delivery.
			const drainFn = () => {
				const records = observer.takeRecords();
				if (records.length > 0) mutationsFn(records);
			};
			const inputFn = (event: PointerEvent) => {
				const path = event.composedPath();
				if (event.type === "pointerdown") {
					if (path.includes(viewportElement)) pointerId = event.pointerId;
					else if (event.pointerId === pointerId) pointerId = undefined;
				}
				if (pointerId === undefined || event.pointerId !== pointerId) return;
				drainFn();
				recordFn("capture-input", {
					type: event.type,
					at: event.timeStamp,
					pointerType: event.pointerType,
					button: event.button,
					buttons: event.buttons,
					trusted: event.isTrusted,
					phase: event.eventPhase,
					defaultPrevented: event.defaultPrevented,
					target: describeFn(event.target),
					currentTarget: describeFn(event.currentTarget),
					path: path.slice(0, 8).map(describeFn),
					...stateFn(),
				});
			};
			const environmentFn = (event: Event) => {
				drainFn();
				recordFn("capture-environment", {
					type: event.type,
					...stateFn(),
				});
			};
			const events = [
				"pointerdown",
				"pointerup",
				"pointercancel",
				"gotpointercapture",
				"lostpointercapture",
			] as const;
			for (const event of events) window.addEventListener(event, inputFn, true);
			window.addEventListener("blur", environmentFn);
			window.addEventListener("focus", environmentFn);
			document.addEventListener("visibilitychange", environmentFn);
			document.addEventListener("pointerlockchange", environmentFn);
			recordFn("capture-observer-attached", stateFn());
			const captureFx = (
				operation: "set" | "release",
				nextPointerId: number,
				reason: string,
			) =>
				Effect.sync(() => {
					pointerId = nextPointerId;
					drainFn();
					recordFn("capture-call", {
						operation,
						reason,
						...stateFn(),
					});
					try {
						if (operation === "set") viewportElement.setPointerCapture(pointerId);
						else viewportElement.releasePointerCapture(pointerId);
						recordFn("capture-returned", {
							operation,
							reason,
							...stateFn(),
						});
					} catch (error) {
						recordFn("capture-threw", {
							operation,
							reason,
							error: String(error),
							...stateFn(),
						});
						throw error;
					}
				});
			return {
				setCaptureFx: (pointerId: number, reason: string) =>
					captureFx("set", pointerId, reason),
				releaseCaptureFx: (pointerId: number, reason: string) =>
					captureFx("release", pointerId, reason),
				closeFx: Effect.sync(() => {
					drainFn();
					observer.disconnect();
					for (const event of events) window.removeEventListener(event, inputFn, true);
					window.removeEventListener("blur", environmentFn);
					window.removeEventListener("focus", environmentFn);
					document.removeEventListener("visibilitychange", environmentFn);
					document.removeEventListener("pointerlockchange", environmentFn);
					recordFn("capture-observer-detached", stateFn());
				}),
			};
		}),
		(owner) => owner.closeFx,
	).pipe(
		Effect.map(
			(owner): attachTilePaintingCaptureTraceFx.Output => ({
				setCaptureFx: owner.setCaptureFx,
				releaseCaptureFx: owner.releaseCaptureFx,
			}),
		),
	);
