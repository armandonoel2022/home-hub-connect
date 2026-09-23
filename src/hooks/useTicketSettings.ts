import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isApiConfigured, ticketsApi } from "@/lib/api";
import type { TicketSettings } from "@/lib/ticketWorkflow";

export function useTicketSettings() {
  const qc = useQueryClient();
  const apiMode = isApiConfigured();
  const query = useQuery({
    queryKey: ["ticket-settings"],
    queryFn: () => (apiMode ? ticketsApi.getSettings() : Promise.resolve({ agents: [] } as TicketSettings)),
    staleTime: 60_000,
  });
  const save = useMutation({
    mutationFn: (s: TicketSettings) => ticketsApi.saveSettings(s),
    onSuccess: (d) => qc.setQueryData(["ticket-settings"], d),
  });
  return { settings: query.data ?? { agents: [] }, save: save.mutateAsync, saving: save.isPending };
}
