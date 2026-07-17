import { mutationOptions } from "@tanstack/react-query";
import { requestApplicationCloseFx } from "~/bridge/lifecycle/requestApplicationCloseFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Complete TanStack mutation contract for trusted native application exit. */
export const exitApplicationMutationOptions = () =>
	mutationOptions({
		mutationKey: [
			"application",
			"exit",
		] as const,
		mutationFn: () => RendererRuntime.runPromise(requestApplicationCloseFx()),
		retry: false,
	});
