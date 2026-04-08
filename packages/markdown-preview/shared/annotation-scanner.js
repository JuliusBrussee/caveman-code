export function normalizeAnnotationText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function advancePastInlineBacktickSpan(source, startIndex) {
  const text = String(source || "");
  let fenceLength = 1;
  while (text[startIndex + fenceLength] === "`") fenceLength += 1;

  let index = startIndex + fenceLength;
  while (index < text.length) {
    const ch = text[index];
    if (ch === "\\") {
      index = Math.min(text.length, index + 2);
      continue;
    }
    if (ch === "`") {
      let runLength = 1;
      while (text[index + runLength] === "`") runLength += 1;
      if (runLength === fenceLength) {
        return index + runLength;
      }
      index += runLength;
      continue;
    }
    if (ch === "\n") {
      return index + 1;
    }
    index += 1;
  }

  return text.length;
}

export function readInlineAnnotationMarkerAt(source, startIndex) {
  const text = String(source || "");
  if (startIndex < 0 || startIndex + 4 > text.length) return null;
  if (text[startIndex] !== "[" || text.slice(startIndex, startIndex + 4).toLowerCase() !== "[an:") {
    return null;
  }

  let index = startIndex + 4;
  while (index < text.length && /\s/.test(text[index])) index += 1;
  const bodyStart = index;
  let squareDepth = 0;

  while (index < text.length) {
    const ch = text[index];
    if (ch === "\\") {
      index = Math.min(text.length, index + 2);
      continue;
    }
    if (ch === "`") {
      index = advancePastInlineBacktickSpan(text, index);
      continue;
    }
    if (ch === "[") {
      squareDepth += 1;
      index += 1;
      continue;
    }
    if (ch === "]") {
      if (squareDepth === 0) {
        const end = index + 1;
        return {
          start: startIndex,
          end,
          raw: text.slice(startIndex, end),
          body: text.slice(bodyStart, index),
        };
      }
      squareDepth -= 1;
      index += 1;
      continue;
    }
    index += 1;
  }

  return null;
}

export function collectInlineAnnotationMarkers(text) {
  const source = String(text || "");
  const markers = [];
  let index = 0;

  while (index < source.length) {
    const ch = source[index];
    if (ch === "\\") {
      index = Math.min(source.length, index + 2);
      continue;
    }
    if (ch === "`") {
      index = advancePastInlineBacktickSpan(source, index);
      continue;
    }
    if (ch === "[" && source.slice(index, index + 4).toLowerCase() === "[an:") {
      const marker = readInlineAnnotationMarkerAt(source, index);
      if (marker) {
        markers.push(marker);
        index = marker.end;
        continue;
      }
    }
    index += 1;
  }

  return markers;
}

export function replaceInlineAnnotationMarkers(text, annotationReplacer, textReplacer) {
  const source = String(text || "");
  const markers = collectInlineAnnotationMarkers(source);
  const replaceAnnotation = typeof annotationReplacer === "function"
    ? annotationReplacer
    : function(marker) { return marker.raw; };
  const replaceText = typeof textReplacer === "function"
    ? textReplacer
    : function(segment) { return segment; };

  if (markers.length === 0) {
    return replaceText(source);
  }

  let out = "";
  let lastIndex = 0;
  markers.forEach(function(marker) {
    if (marker.start > lastIndex) {
      out += String(replaceText(source.slice(lastIndex, marker.start)) ?? "");
    }
    out += String(replaceAnnotation(marker) ?? "");
    lastIndex = marker.end;
  });
  if (lastIndex < source.length) {
    out += String(replaceText(source.slice(lastIndex)) ?? "");
  }
  return out;
}

export function transformMarkdownOutsideFences(text, plainTransformer) {
  const source = String(text || "").replace(/\r\n/g, "\n");
  if (!source) return source;

  const transformPlain = typeof plainTransformer === "function"
    ? plainTransformer
    : function(segment) { return segment; };
  const lines = source.split("\n");
  const out = [];
  let plainBuffer = [];
  let inFence = false;
  let fenceChar = null;
  let fenceLength = 0;

  function flushPlain() {
    if (plainBuffer.length === 0) return;
    const transformed = transformPlain(plainBuffer.join("\n"));
    out.push(typeof transformed === "string" ? transformed : String(transformed ?? ""));
    plainBuffer = [];
  }

  lines.forEach(function(line) {
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1] || "";
      const markerChar = marker.charAt(0);
      const markerLength = marker.length;

      if (!inFence) {
        flushPlain();
        inFence = true;
        fenceChar = markerChar;
        fenceLength = markerLength;
        out.push(line);
        return;
      }

      if (fenceChar === markerChar && markerLength >= fenceLength) {
        inFence = false;
        fenceChar = null;
        fenceLength = 0;
      }

      out.push(line);
      return;
    }

    if (inFence) {
      out.push(line);
    } else {
      plainBuffer.push(line);
    }
  });

  flushPlain();
  return out.join("\n");
}

export function hasMarkdownAnnotationMarkers(text) {
  let found = false;
  transformMarkdownOutsideFences(text, function(segment) {
    if (!found && collectInlineAnnotationMarkers(segment).length > 0) {
      found = true;
    }
    return segment;
  });
  return found;
}

export function stripAnnotationMarkers(text) {
  return transformMarkdownOutsideFences(text, function(segment) {
    return replaceInlineAnnotationMarkers(segment, function() { return ""; });
  });
}

export function prepareMarkdownForPandocPreview(markdown, placeholderPrefix) {
  const placeholders = [];
  const prefix = typeof placeholderPrefix === "string" && placeholderPrefix
    ? placeholderPrefix
    : "PIMDANNOT";
  const prepared = transformMarkdownOutsideFences(markdown, function(segment) {
    return replaceInlineAnnotationMarkers(segment, function(marker) {
      const label = normalizeAnnotationText(marker.body);
      if (!label) return "";
      const token = prefix + placeholders.length + "TOKEN";
      placeholders.push({ token, text: label, title: "[an: " + label + "]" });
      return token;
    });
  });
  return { markdown: prepared, placeholders };
}

export function isAnnotationWordChar(ch) {
  return typeof ch === "string" && /[A-Za-z0-9]/.test(ch);
}

export function readInlineMarkdownLinkAt(source, startIndex) {
  const text = String(source || "");
  if (text[startIndex] !== "[") return null;

  let index = startIndex + 1;
  let squareDepth = 0;
  while (index < text.length) {
    const ch = text[index];
    if (ch === "\\") {
      index = Math.min(text.length, index + 2);
      continue;
    }
    if (ch === "`") {
      index = advancePastInlineBacktickSpan(text, index);
      continue;
    }
    if (ch === "[") {
      squareDepth += 1;
      index += 1;
      continue;
    }
    if (ch === "]") {
      if (squareDepth === 0) break;
      squareDepth -= 1;
      index += 1;
      continue;
    }
    if (ch === "\n") return null;
    index += 1;
  }

  if (index >= text.length || text[index] !== "]" || text[index + 1] !== "(") return null;

  index += 2;
  let parenDepth = 0;
  while (index < text.length) {
    const ch = text[index];
    if (ch === "\\") {
      index = Math.min(text.length, index + 2);
      continue;
    }
    if (ch === "`") {
      index = advancePastInlineBacktickSpan(text, index);
      continue;
    }
    if (ch === "(") {
      parenDepth += 1;
      index += 1;
      continue;
    }
    if (ch === ")") {
      if (parenDepth === 0) {
        return {
          type: "literal",
          raw: text.slice(startIndex, index + 1),
          end: index + 1,
        };
      }
      parenDepth -= 1;
      index += 1;
      continue;
    }
    if (ch === "\n") return null;
    index += 1;
  }

  return null;
}

export function readAnnotationDelimitedTokenAt(source, startIndex, open, close, allowNewlines) {
  const text = String(source || "");
  if (text.slice(startIndex, startIndex + open.length) !== open) return null;

  let index = startIndex + open.length;
  while (index < text.length) {
    const ch = text[index];
    if (!allowNewlines && ch === "\n") return null;
    if (ch === "\\") {
      index = Math.min(text.length, index + 2);
      continue;
    }
    if (text.slice(index, index + close.length) === close) {
      return {
        type: "math",
        raw: text.slice(startIndex, index + close.length),
        end: index + close.length,
      };
    }
    index += 1;
  }

  return null;
}

export function readInlineMathTokenAt(source, startIndex) {
  const text = String(source || "");
  if (text[startIndex] === "\\" && text[startIndex + 1] === "(") {
    return readAnnotationDelimitedTokenAt(text, startIndex, "\\(", "\\)", true);
  }
  if (text[startIndex] === "\\" && text[startIndex + 1] === "[") {
    return readAnnotationDelimitedTokenAt(text, startIndex, "\\[", "\\]", true);
  }
  if (text[startIndex] === "$" && text[startIndex + 1] === "$") {
    return readAnnotationDelimitedTokenAt(text, startIndex, "$$", "$$", true);
  }
  if (text[startIndex] === "$" && text[startIndex + 1] !== "$" && text[startIndex + 1] && !/\s/.test(text[startIndex + 1])) {
    const token = readAnnotationDelimitedTokenAt(text, startIndex, "$", "$", false);
    if (token && token.raw.length > 2) return token;
  }
  return null;
}

export function readBareUrlTokenAt(source, startIndex) {
  const text = String(source || "").slice(startIndex);
  const match = text.match(/^https?:\/\/[^\s<]+/i);
  if (!match) return null;
  return {
    type: "literal",
    raw: match[0],
    end: startIndex + match[0].length,
  };
}

export function readAnnotationProtectedTokenAt(source, startIndex) {
  const text = String(source || "");
  if (startIndex < 0 || startIndex >= text.length) return null;

  if (text[startIndex] === "`") {
    const end = advancePastInlineBacktickSpan(text, startIndex);
    return {
      type: "code",
      raw: text.slice(startIndex, end),
      end,
    };
  }

  const linkToken = text[startIndex] === "["
    ? readInlineMarkdownLinkAt(text, startIndex)
    : null;
  if (linkToken) return linkToken;

  const mathToken = (text[startIndex] === "$" || text[startIndex] === "\\")
    ? readInlineMathTokenAt(text, startIndex)
    : null;
  if (mathToken) return mathToken;

  const urlToken = text[startIndex].toLowerCase() === "h"
    ? readBareUrlTokenAt(text, startIndex)
    : null;
  if (urlToken) return urlToken;

  return null;
}
