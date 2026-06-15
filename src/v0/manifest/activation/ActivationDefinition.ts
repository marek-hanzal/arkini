import type { ProducerDefinition } from "~/v0/manifest/activation/ProducerDefinition";
import type { StashDefinition } from "~/v0/manifest/activation/StashDefinition";

export type ActivationDefinition = ProducerDefinition | StashDefinition;
