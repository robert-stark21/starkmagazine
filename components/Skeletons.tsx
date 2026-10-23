/** Grey placeholders shown instantly while a page or section loads. */

/** The article's meta column and reading column, matching the real layout. */
export function ArticleBodySkeleton() {
  return (
    <div className="d-grid" aria-busy="true" aria-label="Loading">
      <aside className="d-side">
        {[70, 85, 55].map((w, i) => (
          <div key={i} className="sk sk-line" style={{ width: `${w}%` }} />
        ))}
      </aside>
      <div className="d-main">
        <BodySkeleton />
      </div>
    </div>
  );
}

export function BodySkeleton() {
  return (
    <div className="sk-body" aria-busy="true" aria-label="Loading">
      <div className="sk sk-line" style={{ width: "30%" }} />
      <div className="sk sk-block" />
      {[96, 88, 92, 70, 94, 85, 60].map((w, i) => (
        <div key={i} className="sk sk-line" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card">
          <div className="sk sk-thumb" />
          <div className="body">
            <div className="sk sk-line" style={{ width: "40%" }} />
            <div className="sk sk-line" />
            <div className="sk sk-line" style={{ width: "75%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
