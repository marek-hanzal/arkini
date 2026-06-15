export const isStatefulStack = (state: Record<string, unknown> | undefined) =>
	Object.keys(state ?? {}).length > 0;
