import {
	createElement,
	forwardRef,
	type CSSProperties,
	type ComponentPropsWithoutRef,
	type ElementType,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
} from "react";

interface MockMotionValue<T> {
	get: () => T;
	set: (value: T) => void;
	jump: (value: T) => void;
}

interface MockDragBinding {
	readonly node: HTMLElement;
	readonly x: MockMotionValue<number>;
	readonly y: MockMotionValue<number>;
}

interface MockDragControls {
	bind: (binding: MockDragBinding) => void;
	start: (
		event: {
			readonly clientX: number;
			readonly clientY: number;
		},
		options?: {
			readonly snapToCursor?: boolean;
		},
	) => void;
	stop: () => void;
	cancel: () => void;
}

let activeDragBinding: MockDragBinding | null = null;
const motionOffsetBindings = new Map<string, MockDragBinding>();

interface MockAnimationControls extends PromiseLike<void> {
	stop: () => void;
}

interface MotionTestCompletion {
	readonly complete: () => void;
}

export const motionTestRuntime = {
	autoComplete: true,
	reducedMotion: false,
	completions: [] as Array<MotionTestCompletion>,
	reset() {
		this.autoComplete = true;
		this.reducedMotion = false;
		this.completions.splice(0);
		activeDragBinding = null;
		motionOffsetBindings.clear();
	},
	readMotionOffset(ui: string, runtimeId: string) {
		const binding = motionOffsetBindings.get(`${ui}:${runtimeId}`);
		return binding === undefined
			? null
			: {
					x: binding.x.get(),
					y: binding.y.get(),
				};
	},
	readDragOffset() {
		return activeDragBinding === null
			? null
			: {
					x: activeDragBinding.x.get(),
					y: activeDragBinding.y.get(),
				};
	},
	finish(...indexes: ReadonlyArray<number>) {
		for (const index of indexes) this.completions[index]?.complete();
	},
};

export const useReducedMotion = () => motionTestRuntime.reducedMotion;

export const useSpring = <T,>(source: MockMotionValue<T>) => source;

export const useMotionValue = <T,>(initial: T): MockMotionValue<T> => {
	const value = useRef(initial);
	return useMemo(
		() => ({
			get: () => value.current,
			set: (next: T) => {
				value.current = next;
			},
			jump: (next: T) => {
				value.current = next;
			},
		}),
		[],
	);
};

export const animate = <T,>(value: MockMotionValue<T>, target: T): MockAnimationControls => {
	value.set(target);
	const finished = Promise.resolve();
	return {
		then: finished.then.bind(finished),
		stop: () => undefined,
	};
};

export const useDragControls = () =>
	useMemo<MockDragControls>(() => {
		let binding: MockDragBinding | null = null;
		return {
			bind: (next) => {
				binding = next;
				activeDragBinding = next;
			},
			start: (event, options) => {
				if (binding === null || options?.snapToCursor !== true) return;
				const rect = binding.node.getBoundingClientRect();
				binding.x.set(binding.x.get() + event.clientX - (rect.left + rect.width / 2));
				binding.y.set(binding.y.get() + event.clientY - (rect.top + rect.height / 2));
			},
			stop: () => undefined,
			cancel: () => undefined,
		};
	}, []);

interface PanInfoLike {
	readonly point: {
		readonly x: number;
		readonly y: number;
	};
	readonly delta: {
		readonly x: number;
		readonly y: number;
	};
	readonly offset: {
		readonly x: number;
		readonly y: number;
	};
	readonly velocity: {
		readonly x: number;
		readonly y: number;
	};
}

interface MotionOnlyProps {
	readonly animate?: unknown;
	readonly initial?: unknown;
	readonly transition?: unknown;
	readonly drag?: unknown;
	readonly dragControls?: unknown;
	readonly dragListener?: unknown;
	readonly dragMomentum?: unknown;
	readonly dragElastic?: unknown;
	readonly onAnimationComplete?: () => void;
	readonly onDragStart?: (event: PointerEvent, info: PanInfoLike) => void;
	readonly onDrag?: (event: PointerEvent, info: PanInfoLike) => void;
	readonly onDragEnd?: (event: PointerEvent, info: PanInfoLike) => void;
	readonly onHoverStart?: (event: MouseEvent) => void;
	readonly onHoverEnd?: (event: MouseEvent) => void;
}

type MockMotionProps<TElement extends ElementType> = ComponentPropsWithoutRef<TElement> &
	MotionOnlyProps & {
		readonly children?: ReactNode;
	};

const readStyle = (style: CSSProperties | undefined): CSSProperties | undefined => {
	if (style === undefined) return undefined;
	const next: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(style)) {
		if (key === "x" || key === "y") continue;
		if (
			value !== null &&
			typeof value === "object" &&
			"get" in value &&
			typeof value.get === "function"
		) {
			next[key] = value.get();
			continue;
		}
		next[key] = value;
	}
	return next as CSSProperties;
};

const panInfo = (
	event: ReactPointerEvent<HTMLElement>,
	start: {
		readonly x: number;
		readonly y: number;
	},
	previous: {
		readonly x: number;
		readonly y: number;
	},
): PanInfoLike => ({
	point: {
		x: event.clientX,
		y: event.clientY,
	},
	delta: {
		x: event.clientX - previous.x,
		y: event.clientY - previous.y,
	},
	offset: {
		x: event.clientX - start.x,
		y: event.clientY - start.y,
	},
	velocity: {
		x: 0,
		y: 0,
	},
});

const createMotionComponent = <TElement extends ElementType>(element: TElement) =>
	forwardRef<HTMLElement, MockMotionProps<TElement>>(function MockMotionComponent(
		{
			animate: animateTarget,
			initial: _initial,
			transition: _transition,
			drag: _drag,
			dragControls,
			dragListener: _dragListener,
			dragMomentum: _dragMomentum,
			dragElastic: _dragElastic,
			onAnimationComplete,
			onDragStart,
			onDrag,
			onDragEnd,
			onHoverStart,
			onHoverEnd,
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onPointerCancel,
			onMouseEnter,
			onMouseLeave,
			style,
			...props
		},
		ref,
	) {
		const gesture = useRef<{
			start: {
				x: number;
				y: number;
			};
			previous: {
				x: number;
				y: number;
			};
			started: boolean;
		} | null>(null);

		useEffect(() => {
			if (onAnimationComplete === undefined) return;
			let active = true;
			const completion = {
				complete: () => {
					if (!active) return;
					active = false;
					onAnimationComplete();
				},
			};
			motionTestRuntime.completions.push(completion);
			if (motionTestRuntime.autoComplete) queueMicrotask(completion.complete);
			return () => {
				active = false;
			};
		}, [
			animateTarget,
			onAnimationComplete,
		]);

		const motionScale =
			typeof animateTarget === "object" && animateTarget !== null && "scale" in animateTarget
				? String(animateTarget.scale)
				: undefined;

		const motionStyle = style as
			| (CSSProperties & {
					readonly x?: MockMotionValue<number>;
					readonly y?: MockMotionValue<number>;
			  })
			| undefined;
		const ui = typeof props["data-ui"] === "string" ? props["data-ui"] : null;
		const runtimeId =
			typeof props["data-motion-id"] === "string" ? props["data-motion-id"] : null;

		useEffect(() => {
			if (
				ui === null ||
				runtimeId === null ||
				motionStyle?.x === undefined ||
				motionStyle.y === undefined
			)
				return;
			const key = `${ui}:${runtimeId}`;
			const binding = {
				node: document.createElement("span"),
				x: motionStyle.x,
				y: motionStyle.y,
			};
			motionOffsetBindings.set(key, binding);
			return () => {
				if (motionOffsetBindings.get(key) === binding) motionOffsetBindings.delete(key);
			};
		}, [
			motionStyle?.x,
			motionStyle?.y,
			runtimeId,
			ui,
		]);

		return createElement(element, {
			...props,
			ref,
			style: readStyle(style),
			"data-motion-scale": motionScale,
			onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
				if (
					typeof dragControls === "object" &&
					dragControls !== null &&
					"bind" in dragControls &&
					typeof dragControls.bind === "function" &&
					motionStyle?.x !== undefined &&
					motionStyle.y !== undefined
				) {
					(dragControls as MockDragControls).bind({
						node: event.currentTarget,
						x: motionStyle.x,
						y: motionStyle.y,
					});
				}
				onPointerDown?.(event as never);
				gesture.current = {
					start: {
						x: event.clientX,
						y: event.clientY,
					},
					previous: {
						x: event.clientX,
						y: event.clientY,
					},
					started: false,
				};
			},
			onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
				onPointerMove?.(event as never);
				const current = gesture.current;
				if (current === null) return;
				const info = panInfo(event, current.start, current.previous);
				if (!current.started && Math.hypot(info.offset.x, info.offset.y) >= 6) {
					current.started = true;
					onDragStart?.(event.nativeEvent, info);
				}
				if (current.started) onDrag?.(event.nativeEvent, info);
				current.previous = {
					x: event.clientX,
					y: event.clientY,
				};
			},
			onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
				const current = gesture.current;
				if (current?.started) {
					onDragEnd?.(event.nativeEvent, panInfo(event, current.start, current.previous));
				}
				gesture.current = null;
				onPointerUp?.(event as never);
			},
			onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
				gesture.current = null;
				onPointerCancel?.(event as never);
			},
			onMouseEnter: (event: ReactMouseEvent<HTMLElement>) => {
				onMouseEnter?.(event as never);
				onHoverStart?.(event.nativeEvent);
			},
			onMouseLeave: (event: ReactMouseEvent<HTMLElement>) => {
				onMouseLeave?.(event as never);
				onHoverEnd?.(event.nativeEvent);
			},
		});
	});

export const motion = {
	button: createMotionComponent("button"),
	div: createMotionComponent("div"),
	span: createMotionComponent("span"),
};
