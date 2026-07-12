"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
  toast,
} from "@daromsart/ui";
import type { ClientInput } from "@daromsart/core";
import {
  createClientAction,
  getClientForEditAction,
  updateClientAction,
} from "@/modules/clients/actions";
import {
  ClientForm,
  CLIENT_FORM_EMPTY_VALUES,
  type ClientFormValues,
} from "./client-form";

export type ClientSheetState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; clientId: string };

export interface ClientSheetProps {
  state: ClientSheetState;
  onClose: () => void;
  onSaved: () => void;
}

export function ClientSheet({ state, onClose, onSaved }: ClientSheetProps) {
  const [values, setValues] = useState<ClientFormValues | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (state.mode === "create") {
      setValues(CLIENT_FORM_EMPTY_VALUES);
    } else if (state.mode === "edit") {
      setValues(null);
      setLoading(true);
      getClientForEditAction(state.clientId)
        .then((client) => {
          if (!client) {
            toast.error("Client introuvable.");
            onClose();
            return;
          }
          setValues({
            type: client.type,
            displayName: client.displayName,
            legalName: client.legalName ?? "",
            siret: client.siret ?? "",
            vatNumber: client.vatNumber ?? "",
            email: client.email ?? "",
            phone: client.phone ?? "",
            addressStreet: client.addressStreet ?? "",
            addressZip: client.addressZip ?? "",
            addressCity: client.addressCity ?? "",
            addressCountry: client.addressCountry,
            notes: client.notes ?? "",
            paymentTermsDays: client.paymentTermsDays?.toString() ?? "",
            contacts: client.contacts.map((c) => ({
              contactId: c.id,
              name: c.name,
              email: c.email ?? "",
              phone: c.phone ?? "",
              role: c.role ?? "",
            })),
          });
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne dépend que de l'identité de state
  }, [state.mode, state.mode === "edit" ? state.clientId : null]);

  async function handleSubmit(input: ClientInput) {
    const result =
      state.mode === "edit"
        ? await updateClientAction(state.clientId, input)
        : state.mode === "create"
          ? await createClientAction(input)
          : { ok: false as const, errors: {} };
    return result;
  }

  function handleSuccess() {
    toast.success(state.mode === "edit" ? "Client mis à jour." : "Client créé.");
    onSaved();
  }

  return (
    <Sheet open={state.mode !== "closed"} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {state.mode === "edit" ? "Modifier le client" : "Nouveau client"}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          {loading || !values ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <ClientForm
              key={state.mode === "edit" ? state.clientId : "create"}
              defaultValues={values}
              onSubmit={handleSubmit}
              onSuccess={handleSuccess}
              submitLabel={state.mode === "edit" ? "Enregistrer" : "Créer le client"}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
