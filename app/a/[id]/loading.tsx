import { ArticleBodySkeleton } from "@/components/Skeletons";

/** Shown instantly when you open an article, until its top part is ready. */
export default function Loading() {
  return (
    <>
      <main className="wrap">
        <article className="detail">
          <div className="d-head">
            <div className="sk sk-line" style={{ width: 90 }} />
            <div className="sk sk-title" style={{ width: "85%" }} />
            <div className="sk sk-title" style={{ width: "55%" }} />
          </div>
          <div className="sk sk-hero d-hero" />
          <ArticleBodySkeleton />
        </article>
      </main>
    </>
  );
}
