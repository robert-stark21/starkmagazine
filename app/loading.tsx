import { Header } from "@/components/Header";
import { lastUpdated } from "@/lib/feeds";
import { getLang } from "@/lib/lang";
import { GridSkeleton } from "@/components/Skeletons";

/** Shown instantly when you click a link, until the new page is ready. */
export default async function Loading() {
  const lang = await getLang();
  return (
    <>
    <Header lang={lang} updated={lastUpdated()} />
    <main className="wrap">
      <div className="page-h">
        <div className="sk sk-title" />
      </div>
      <GridSkeleton count={8} />
    </main>
    </>
  );
}
