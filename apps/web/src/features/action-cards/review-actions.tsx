"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { updateActionCardStatus } from "./api";
import type { ActionCardReviewStatus, ActionCardStatus } from "./types";

type ReviewAction = {
  label: string;
  status: ActionCardReviewStatus;
  variant?: ComponentProps<typeof Button>["variant"];
};

const REVIEW_ACTIONS: ReviewAction[] = [
  {
    label: "Approve",
    status: "approved",
  },
  {
    label: "Mark edited",
    status: "edited",
    variant: "outline",
  },
  {
    label: "Reject",
    status: "rejected",
    variant: "ghost",
  },
];

export function ReviewActions({
  actionCardId,
  currentStatus,
}: {
  actionCardId: string;
  currentStatus: ActionCardStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedStatus, setSelectedStatus] =
    useState<ActionCardReviewStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleStatusChange(status: ActionCardReviewStatus) {
    setSelectedStatus(status);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        await updateActionCardStatus(actionCardId, status);
        router.refresh();
      } catch {
        setErrorMessage("Status update failed.");
      } finally {
        setSelectedStatus(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {REVIEW_ACTIONS.map((action) => (
          <Button
            className="w-full justify-center rounded-md"
            disabled={isPending || currentStatus === action.status}
            key={action.status}
            onClick={() => handleStatusChange(action.status)}
            type="button"
            variant={action.variant}
          >
            {selectedStatus === action.status ? "Saving" : action.label}
          </Button>
        ))}
      </div>

      {errorMessage ? (
        <p className="text-sm text-red-700">{errorMessage}</p>
      ) : null}
    </div>
  );
}
