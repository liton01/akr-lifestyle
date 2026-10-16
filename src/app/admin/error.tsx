"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <EmptyState
      title="This page failed to load"
      description={error.digest ? `Reference: ${error.digest}` : "Please try again."}
      action={<Button onClick={() => reset()}>Try again</Button>}
    />
  );
}
