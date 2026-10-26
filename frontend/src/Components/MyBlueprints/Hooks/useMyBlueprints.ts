// Third Party
import { useQuery } from "@tanstack/react-query";

// AA bpforge
// AA Blueprint Forge
import { loadMyBlueprints } from "@/Api/ApiCalls";
import { queryKeys } from "@/Api/query";

/** Loads the blueprints of the current user. */
export function useMyBlueprints() {
  return useQuery({
    queryKey: queryKeys.MyBlueprints,
    queryFn: loadMyBlueprints,
  });
}
