// Stable color per tag name. A small hash picks a hue; fixed saturation and
// lightness keep the dot legible on both light and dark surfaces. Cheap and
// deterministic — no palette config to maintain.
export function tagColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 60% 55%)`;
}
