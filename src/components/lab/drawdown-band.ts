import type { IChartApi, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesPrimitive, SeriesAttachedParameter, Time, UTCTimestamp } from "lightweight-charts";

type Target = Parameters<IPrimitivePaneRenderer["draw"]>[0];
export type DrawdownBandSpan = { from: UTCTimestamp; to: UTCTimestamp; label: string };
export type DrawdownBandStyle = { fill: string; edge: string; text: string; labelBackground: string; font: string };

/**
 * Highlights the largest drawdown from the peak bar to the trough bar. It is anchored to
 * bar times, so it follows zooming and panning without a DOM overlay. The band sits
 * behind the series; only its short label is drawn above, in the price-scale top margin.
 */
export class DrawdownBand implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private requestUpdate: (() => void) | null = null;
  private span: DrawdownBandSpan | null = null;
  private readonly views: readonly IPrimitivePaneView[];

  constructor(private readonly style: DrawdownBandStyle) {
    const band: IPrimitivePaneRenderer = { draw: () => {}, drawBackground: (target) => this.drawBand(target) };
    const label: IPrimitivePaneRenderer = { draw: (target) => this.drawLabel(target) };
    this.views = [{ zOrder: () => "bottom", renderer: () => this.span ? band : null }, { zOrder: () => "top", renderer: () => this.span ? label : null }];
  }

  attached({ chart, requestUpdate }: SeriesAttachedParameter<Time>) {
    this.chart = chart as IChartApi;
    this.requestUpdate = requestUpdate;
  }

  detached() {
    this.chart = null;
    this.requestUpdate = null;
  }

  setSpan(span: DrawdownBandSpan | null) {
    this.span = span;
    this.requestUpdate?.();
  }

  paneViews() {
    return this.views;
  }

  /** Pixel edges, extended by half a bar so the band covers the peak and trough bars whole. */
  private edges() {
    if (!this.chart || !this.span) return null;
    const timeScale = this.chart.timeScale();
    const from = timeScale.timeToCoordinate(this.span.from);
    const to = timeScale.timeToCoordinate(this.span.to);
    if (from === null || to === null) return null;
    const half = timeScale.options().barSpacing / 2;
    return { left: Math.min(from, to) - half, right: Math.max(from, to) + half };
  }

  private drawBand(target: Target) {
    const edges = this.edges();
    if (!edges) return;
    target.useBitmapCoordinateSpace(({ context, bitmapSize, horizontalPixelRatio }) => {
      const left = Math.round(edges.left * horizontalPixelRatio);
      const right = Math.round(edges.right * horizontalPixelRatio);
      if (right < 0 || left > bitmapSize.width) return;
      context.fillStyle = this.style.fill;
      context.fillRect(left, 0, Math.max(1, right - left), bitmapSize.height);
      context.fillStyle = this.style.edge;
      const line = Math.max(1, Math.floor(horizontalPixelRatio));
      context.fillRect(left, 0, line, bitmapSize.height);
      context.fillRect(right - line, 0, line, bitmapSize.height);
    });
  }

  private drawLabel(target: Target) {
    const edges = this.edges();
    if (!edges || !this.span) return;
    const text = this.span.label;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.font = this.style.font;
      const width = context.measureText(text).width + 12;
      // Keep the label inside the pane and as close to the band's left edge as possible.
      const x = Math.min(Math.max(edges.left + 4, 4), mediaSize.width - width - 4);
      if (edges.right < 0 || edges.left > mediaSize.width || x < 0) return;
      context.fillStyle = this.style.labelBackground;
      context.beginPath();
      context.roundRect(x, 6, width, 20, 4);
      context.fill();
      context.fillStyle = this.style.text;
      context.textBaseline = "middle";
      context.fillText(text, x + 6, 16.5);
    });
  }
}
