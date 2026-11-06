// Educational proxy, NOT a calibrated canine/feline appearance model.
// Machado, Oliveira & Fernandes (2009), full deuteranopia, linear sRGB.
// https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
export const MATRIX = Object.freeze([
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.011820, 0.042940, 0.968881],
]);
export const decode = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
export const encode = c => {
  c = Math.max(0, Math.min(1, c));
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
};
const lookup = Float64Array.from({length: 256}, (_, i) => decode(i / 255));
export function transformPixels(source) {
  if (source.length % 4) throw new Error('RGBA pixels required');
  const result = new Uint8ClampedArray(source.length);
  for (let i = 0; i < source.length; i += 4) {
    const r = lookup[source[i]], g = lookup[source[i+1]], b = lookup[source[i+2]];
    for (let j = 0; j < 3; j++) result[i+j] = encode(MATRIX[j][0]*r + MATRIX[j][1]*g + MATRIX[j][2]*b);
    result[i+3] = source[i+3];
  }
  return result;
}
export function fittedSize(width, height, maxSide = 1600) {
  if (!(width > 0 && height > 0 && Number.isFinite(width + height))) throw new Error('Invalid image dimensions');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {width: Math.max(1, Math.round(width*scale)), height: Math.max(1, Math.round(height*scale))};
}
export const SPECIES = Object.freeze({
  dog: {label:'いぬ', title:'赤いボール、草むらで見つかるかな？', note:'犬は主に2種類の錐体で色を捉えます。赤と緑の違いが、人ほどはっきりしないことが知られています。青いおもちゃと比べてみよう。'},
  cat: {label:'ねこ', title:'猫の世界も、モノクロではない。', note:'猫にも主に2種類の錐体があり、色を区別できます。暗いところで見る力と、色の見分け方は別の話。いつもの景色を見比べてみよう。'},
});
