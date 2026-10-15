import Image, { type ImageProps } from "next/image";

/**
 * Guide illustrations from /investi-assets/guide. `ground` is how far the drawn ground line (or the
 * soles, where a pose has no line) sits above the image's bottom edge, in % of the image height.
 */
export const guidePoses = {
  "01-welcome": { width: 710, height: 710, ground: 7.39 },
  "02-thinking": { width: 525, height: 525, ground: 8.95 },
  "03-explaining": { width: 627, height: 627, ground: 6.54 },
  "04-calm-book": { width: 477, height: 477, ground: 7.34 },
  "05-shrug": { width: 780, height: 780, ground: 7.44 },
  "06-map": { width: 656, height: 656, ground: 8.54 },
  "07-small-joy": { width: 686, height: 686, ground: 7.29 },
  "08-leaning": { width: 680, height: 680, ground: 12.28 },
  "10-diversification": { width: 789, height: 592, ground: 7.43 },
  "12-compounding": { width: 859, height: 644, ground: 8.23 },
  "14-returns": { width: 824, height: 618, ground: 7.8 },
  "15-weights": { width: 715, height: 536, ground: 7.28 },
  "16-bid-ask": { width: 715, height: 536, ground: 7.28 },
  "17-reading-armchair": { width: 850, height: 638, ground: 7.4 },
  "18-bookshelf": { width: 1448, height: 1086, ground: 5.99 },
  "20-searching-box": { width: 872, height: 654, ground: 8.6 },
  "21-hourglass": { width: 749, height: 562, ground: 8 },
} as const;

export type GuidePoseName = keyof typeof guidePoses;

/**
 * The guide stands on whatever sits directly under the image box: the image is shifted down by its
 * ground offset, so layouts only align the box's bottom edge with the top edge of the card below.
 * Size the box by width with `height: auto` so the percentage offset matches the drawn art.
 */
export function GuideImage({ pose, alt, style, ...props }: { pose: GuidePoseName } & Omit<ImageProps, "src" | "width" | "height">) {
  const { width, height, ground } = guidePoses[pose];
  return <Image src={`/investi-assets/guide/${pose}.webp`} width={width} height={height} alt={alt} data-guide-pose={pose} style={{ translate: `0 ${ground}%`, ...style }} {...props} />;
}
