"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page py-16">
      <EmptyState
        title="Something went wrong"
        description={
          <>
            We could not load this page. Please try again in a moment.
            {error.digest ? <span className="mt-2 block text-xs text-muted">Reference: {error.digest}</span> : null}
          </>
        }
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => reset()}>Try again</Button>
            <ButtonLink href="/" variant="outline">
              Go to home
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
