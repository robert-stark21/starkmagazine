import { GridSkeleton } from "@/components/Skeletons";

/** Shown instantly when you click a link, until the new page is ready. */
export default function Loading() {
  return (
    <>
    <main className="wrap">
      <div className="page-h">
        <div className="sk sk-title" />
      </div>
      <GridSkeleton count={8} />
    </main>
    </>
  );
}
