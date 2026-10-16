import { ProductGridSkeleton } from "@/components/store/product-card";

export default function StoreLoading() {
  return (
    <div className="container-page py-10" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton mt-4 h-10 w-72" />
      <div className="mt-10">
        <ProductGridSkeleton />
      </div>
    </div>
  );
}
