import { useMutation } from "@tanstack/react-query";
import { writeCheatAvailabilityFx } from "~/bridge/cheat/writeCheatAvailabilityFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { useCheatAvailability } from "~/ui/cheat-availability/useCheatAvailability";

/** Persists and publishes application-wide cheat-tool availability. */
export const useSetCheatAvailabilityMutation = () => {
	const availability = useCheatAvailability();
	return useMutation({
		mutationKey: [
			"preferences",
			"cheats",
			"available",
		],
		mutationFn: (available: boolean) =>
			RendererRuntime.runPromise(writeCheatAvailabilityFx(available)),
		onSuccess: (_, available) => availability.apply(available),
		retry: false,
	});
};
