// Computes the axis-aligned bounding box of a flat polygon points array [x1,y1,x2,y2,...].
// Used to keep Stall.posX/posY/width/height in sync as a bounding-box shortcut whenever a
// "poly"-shaped stall's points change — hit-testing, label placement, and scroll-to-stall
// all use the bounding box rather than doing real point-in-polygon math.
export function boundingBoxOfPolygon(points: number[]): { posX: number; posY: number; width: number; height: number } {
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { posX: minX, posY: minY, width: maxX - minX, height: maxY - minY };
}
