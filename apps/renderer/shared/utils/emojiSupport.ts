const EMOJI_RENDER_CANVAS_SIZE = 64;

export const EMOJI_FONT_FAMILY =
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

type EmojiRenderSignature = {
  nonTransparentPixels: number;
  bounds: string;
  hash: number;
};

let renderContext: CanvasRenderingContext2D | null | undefined;
let missingGlyphSignatures: EmojiRenderSignature[] | null = null;
const emojiSupportCache = new Map<string, boolean>();
const emojiCompositeSupportCache = new Map<string, boolean>();

const getRenderContext = (): CanvasRenderingContext2D | null => {
  if (renderContext !== undefined) {
    return renderContext;
  }

  if (typeof document === 'undefined') {
    renderContext = null;
    return renderContext;
  }

  const canvas = document.createElement('canvas');
  canvas.width = EMOJI_RENDER_CANVAS_SIZE;
  canvas.height = EMOJI_RENDER_CANVAS_SIZE;
  renderContext = canvas.getContext('2d', { willReadFrequently: true });
  return renderContext;
};

const getRenderSignature = (value: string): EmojiRenderSignature | null => {
  const context = getRenderContext();
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, EMOJI_RENDER_CANVAS_SIZE, EMOJI_RENDER_CANVAS_SIZE);
  context.save();
  context.font = `48px ${EMOJI_FONT_FAMILY}`;
  context.textBaseline = 'top';
  context.fillStyle = '#000';
  context.fillText(value, 8, 4);
  context.restore();

  const { data, width, height } = context.getImageData(
    0,
    0,
    EMOJI_RENDER_CANVAS_SIZE,
    EMOJI_RENDER_CANVAS_SIZE
  );

  let nonTransparentPixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let hash = 2166136261;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha === 0) {
      continue;
    }

    const pixelIndex = index / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    nonTransparentPixels += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);

    hash ^= data[index];
    hash = Math.imul(hash, 16777619);
    hash ^= data[index + 1];
    hash = Math.imul(hash, 16777619);
    hash ^= data[index + 2];
    hash = Math.imul(hash, 16777619);
    hash ^= alpha;
    hash = Math.imul(hash, 16777619);
  }

  return {
    nonTransparentPixels,
    bounds:
      nonTransparentPixels === 0
        ? 'empty'
        : `${minX},${minY},${Math.max(0, maxX - minX)},${Math.max(0, maxY - minY)}`,
    hash: hash >>> 0,
  };
};

const getMissingGlyphSignatures = (): EmojiRenderSignature[] => {
  if (missingGlyphSignatures) {
    return missingGlyphSignatures;
  }

  missingGlyphSignatures = ['\uE000', '\uE001', '\u0378', '\uFFFF']
    .map((value) => getRenderSignature(value))
    .filter((signature): signature is EmojiRenderSignature => signature !== null);

  return missingGlyphSignatures;
};

export const isEmojiGlyphSupported = (glyph: string): boolean => {
  const cached = emojiSupportCache.get(glyph);
  if (cached !== undefined) {
    return cached;
  }

  const signature = getRenderSignature(glyph);
  if (!signature || signature.nonTransparentPixels === 0) {
    emojiSupportCache.set(glyph, true);
    return true;
  }

  const isMissingGlyph = getMissingGlyphSignatures().some(
    (missingGlyphSignature) =>
      signature.nonTransparentPixels === missingGlyphSignature.nonTransparentPixels &&
      signature.bounds === missingGlyphSignature.bounds &&
      signature.hash === missingGlyphSignature.hash
  );

  const isSupported = !isMissingGlyph;
  emojiSupportCache.set(glyph, isSupported);
  return isSupported;
};

const isEquivalentRenderSignature = (
  left: EmojiRenderSignature | null,
  right: EmojiRenderSignature | null
): boolean => {
  if (!left || !right) return false;
  return (
    left.nonTransparentPixels === right.nonTransparentPixels &&
    left.bounds === right.bounds &&
    left.hash === right.hash
  );
};

export const isEmojiCompositeGlyphSupported = (glyph: string): boolean => {
  const cached = emojiCompositeSupportCache.get(glyph);
  if (cached !== undefined) {
    return cached;
  }

  if (!glyph.includes('\u200d')) {
    emojiCompositeSupportCache.set(glyph, true);
    return true;
  }

  const combinedSignature = getRenderSignature(glyph);
  const decomposedSignature = getRenderSignature(glyph.replace(/\u200d/g, ''));

  if (!combinedSignature || !decomposedSignature) {
    emojiCompositeSupportCache.set(glyph, true);
    return true;
  }

  const isSupported = !isEquivalentRenderSignature(combinedSignature, decomposedSignature);
  emojiCompositeSupportCache.set(glyph, isSupported);
  return isSupported;
};
