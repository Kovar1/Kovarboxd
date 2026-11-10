import { cutOutline } from "@/lib/cut";
import { TmdbImage } from "./TmdbImage";

type Props = {
  /** The film or person id, which fixes the outline. */
  id: number;
  path: string | null;
  alt: string;
  width: number;
  aspect?: "poster" | "profile";
  priority?: boolean;
  /** Real color. Otherwise it prints black on yellow until hovered. */
  full?: boolean;
};

/** A poster or portrait cut out of paper. */
export function CutImage({ id, path, alt, width, aspect = "poster", priority, full }: Props) {
  return (
    <div className={full ? "sh full" : "sh"} style={{ clipPath: cutOutline(id) }}>
      <TmdbImage path={path} alt={alt} width={width} aspect={aspect} priority={priority} />
    </div>
  );
}
