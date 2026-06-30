"use client";

import { Check, Pencil, X } from "lucide-react";
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

function actionClassName(status: ActionCardReviewStatus) {
  if (status === "approved") {
    return "w-full justify-center rounded-md border-blue-600 bg-blue-600 text-white hover:bg-blue-700";
  }
  if (status === "rejected") {
    return "w-full justify-center rounded-md text-red-700 hover:bg-red-50";
  }
  return "w-full justify-center rounded-md";
}

function ActionIcon({ status }: { status: ActionCardReviewStatus }) {
  if (status === "approved") {
    return <Check className="size-4" />;
  }
  if (status === "edited") {
    return <Pencil className="size-4" />;
  }
  return <X className="size-4" />;
}

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
            className={actionClassName(action.status)}
            disabled={isPending || currentStatus === action.status}
            key={action.status}
            onClick={() => handleStatusChange(action.status)}
            type="button"
            variant={action.variant}
          >
            <ActionIcon status={action.status} />
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
