import { getRouteApi } from "@tanstack/react-router";

const gameRouteApi = getRouteApi("/game/$packageId");

/** Reads the authoritative route-scoped Game Engine created by the game resource loader. */
export const useGameEngine = () => gameRouteApi.useLoaderData();
