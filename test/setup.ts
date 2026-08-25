if (typeof window !== "undefined") {
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: () => undefined,
		writable: true,
	});
}

if (typeof HTMLCanvasElement !== "undefined") {
	Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
		configurable: true,
		value: () => null,
		writable: true,
	});
}
