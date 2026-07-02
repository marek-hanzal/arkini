import { genId } from "~/id/logic/genId";

const createGameEntityId = (prefix: string) => `${prefix}:${genId()}`;

export const createGameItemInstanceId = () => createGameEntityId("item-instance");

export const createGameJobId = () => createGameEntityId("job");

export const createGameActiveEffectId = () => createGameEntityId("effect-instance");

export const createGameItemSpawnJobId = () => createGameEntityId("item-spawn-job");
