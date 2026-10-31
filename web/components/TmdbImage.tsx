import Image from "next/image";

type Props = {
  path: string | null;
  alt: string;
  /** Rendered width in CSS pixels. Height follows the aspect ratio. */
  width: number;
  aspect: "poster" | "profile" | "backdrop";
  priority?: boolean;
  className?: string;
};

// Posters and profiles are 2:3, backdrops 16:9.
const RATIO = { poster: 1.5, profile: 1.5, backdrop: 9 / 16 };

/** A TMDb image through next/image, or a plain placeholder when there's none. */
export function TmdbImage({ path, alt, width, aspect, priority, className }: Props) {
  const height = Math.round(width * RATIO[aspect]);
  if (!path) {
    return (
      <div className={`img-placeholder ${aspect} ${className ?? ""}`} style={{ aspectRatio: `${width} / ${height}` }}>
        <span>{alt.slice(0, 1)}</span>
      </div>
    );
  }
  return (
    <Image
      src={path}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={`tmdb-img ${aspect} ${className ?? ""}`}
    />
  );
}
