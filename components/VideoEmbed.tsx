import { HlsVideo } from "./client";

/** A YouTube/Vimeo player or a native video from the original article, in a responsive 16:9 frame. */
export function VideoEmbed({
  provider,
  src,
  poster,
  caption,
}: {
  provider: "youtube" | "vimeo" | "file" | "hls";
  src: string;
  poster?: string;
  caption?: string;
}) {
  return (
    <figure className="prose-video">
      <div className="frame">
        {provider === "hls" ? (
          <HlsVideo src={src} poster={poster} />
        ) : provider === "file" ? (
          <video src={src} poster={poster} controls preload="metadata" playsInline />
        ) : (
          <iframe
            src={src}
            title={caption ?? "Video"}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
