// GIF89a encoder. Pure: takes indexed frames, returns bytes.
//
// palette: up to 15 "#rrggbb" strings; pixel value 0 is transparent and value n
// is palette[n - 1]. frames: Uint8Array(width * height) each. delays: hundredths
// of a second per frame.

const MIN_CODE_SIZE = 4;

export function encodeGif({ width, height, palette, frames, delays }) {
  const out = [];
  const word = (v) => out.push(v & 255, (v >> 8) & 255);
  const text = (s) => { for (const ch of s) out.push(ch.charCodeAt(0)); };

  text('GIF89a');
  word(width);
  word(height);
  out.push(0xf3, 0, 0); // global table of 16 colours, background 0, no aspect

  for (let i = 0; i < 16; i += 1) {
    const colour = i === 0 ? null : palette[i - 1];
    if (colour) out.push(parseInt(colour.slice(1, 3), 16), parseInt(colour.slice(3, 5), 16), parseInt(colour.slice(5, 7), 16));
    else out.push(0, 0, 0);
  }

  out.push(0x21, 0xff, 11);
  text('NETSCAPE2.0');
  out.push(3, 1, 0, 0, 0); // loop forever

  frames.forEach((pixels, index) => {
    out.push(0x21, 0xf9, 4, 0x09); // disposal 2 (restore to background), transparency on
    word(delays[index]);
    out.push(0, 0); // transparent index 0, terminator
    out.push(0x2c);
    word(0);
    word(0);
    word(width);
    word(height);
    out.push(0);
    out.push(MIN_CODE_SIZE);
    const data = lzw(pixels);
    for (let at = 0; at < data.length; at += 255) {
      const block = data.slice(at, at + 255);
      out.push(block.length, ...block);
    }
    out.push(0);
  });

  out.push(0x3b);
  return Uint8Array.from(out);
}

function lzw(pixels) {
  const clear = 1 << MIN_CODE_SIZE;
  const end = clear + 1;
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  let codeSize = MIN_CODE_SIZE + 1;
  let next = end + 1;
  let table = new Map();

  const emit = (code) => {
    buffer |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      bytes.push(buffer & 255);
      buffer >>= 8;
      bits -= 8;
    }
  };

  emit(clear);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i += 1) {
    const pixel = pixels[i];
    const key = prefix * 16 + pixel;
    const found = table.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      table = new Map();
      next = end + 1;
      codeSize = MIN_CODE_SIZE + 1;
    } else {
      table.set(key, next);
      if (next === 1 << codeSize && codeSize < 12) codeSize += 1;
      next += 1;
    }
    prefix = pixel;
  }
  emit(prefix);
  emit(end);
  if (bits > 0) bytes.push(buffer & 255);
  return bytes;
}
