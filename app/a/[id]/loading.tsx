import { Header } from "@/components/Header";
import { lastUpdated } from "@/lib/feeds";
import { getLang } from "@/lib/lang";
import { BodySkeleton } from "@/components/Skeletons";

/** Shown instantly when you open an article, until its top part is ready. */
export default async function Loading() {
  const lang = await getLang();
  return (
    <>
    <Header lang={lang} updated={lastUpdated()} />
    <main className="wrap">
      <article className="detail">
        <div className="sk sk-line" style={{ width: "20%" }} />
        <div className="sk sk-title" />
        <div className="sk sk-title" style={{ width: "60%" }} />
        <div className="sk sk-hero" />
        <BodySkeleton />
      </article>
    </main>
    </>
  );
}
