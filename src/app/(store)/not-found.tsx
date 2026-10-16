import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function StoreNotFound() {
  return (
    <div className="container-page py-16">
      <EmptyState
        icon={<SearchX className="h-10 w-10" />}
        title="We couldn't find that page"
        description="The product or page may no longer be available. Try searching or browse our collection."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/shop">Browse products</ButtonLink>
            <ButtonLink href="/search" variant="outline">
              Search
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
