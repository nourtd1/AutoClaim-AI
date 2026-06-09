"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import ClaimStageProgress from "@/components/ClaimStageProgress";

interface Props {
  claimId:        string;
  initialStage?:  string | null | undefined;
  initialStatus?: string | null | undefined;
}

export default function ClaimPageLiveWrapper({ claimId, initialStage, initialStatus }: Props) {
  const router = useRouter();

  const handleUpdate = useCallback(() => {
    router.refresh(); // re-fetches Server Components in place with latest DB data
  }, [router]);

  return (
    <ClaimStageProgress
      claimId={claimId}
      initialStage={initialStage}
      initialStatus={initialStatus}
      onStageUpdate={handleUpdate}
    />
  );
}
