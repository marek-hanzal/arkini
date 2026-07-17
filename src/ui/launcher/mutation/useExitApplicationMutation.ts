import { useMutation } from "@tanstack/react-query";
import { exitApplicationMutationOptions } from "~/ui/launcher/mutation/exitApplicationMutationOptions";

/** Runs the complete trusted native application-exit mutation. */
export const useExitApplicationMutation = () => useMutation(exitApplicationMutationOptions());
