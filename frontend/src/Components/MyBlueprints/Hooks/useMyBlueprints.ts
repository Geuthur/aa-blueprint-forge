// Third Party
import { useQuery } from "@tanstack/react-query";

// AA bpforge
import { loadMyBlueprints, myBlueprintsQueryKeys } from "@/Api/calls/myBlueprints";

/** Loads the blueprints of the current user. */
export function useMyBlueprints() {
  return useQuery({
    queryKey: myBlueprintsQueryKeys.blueprints,
    queryFn: loadMyBlueprints,
  });
}
