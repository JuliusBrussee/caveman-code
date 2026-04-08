(() => {
  function normalizePreviewAnnotationLabel(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function advancePastBacktickSpan(source, startIndex) {
    let fenceLength = 1;
    while (source[startIndex + fenceLength] === "`") fenceLength += 1;

    let index = startIndex + fenceLength;
    while (index < source.length) {
      const ch = source[index];
      if (ch === "\\") {
        index = Math.min(source.length, index + 2);
        continue;
      }
      if (ch === "`") {
        let runLength = 1;
        while (source[index + runLength] === "`") runLength += 1;
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

    return source.length;
  }

  function readInlineAnnotationMarkerAt(source, startIndex) {
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
        index = advancePastBacktickSpan(text, index);
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
            end: end,
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

  function collectInlineAnnotationMarkers(text) {
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
        index = advancePastBacktickSpan(source, index);
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

  function replaceInlineAnnotationMarkers(text, annotationReplacer, textReplacer) {
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

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isWordChar(ch) {
    return typeof ch === "string" && /[A-Za-z0-9]/.test(ch);
  }

  function readInlineMarkdownLinkAt(source, startIndex) {
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
        index = advancePastBacktickSpan(text, index);
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
        index = advancePastBacktickSpan(text, index);
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

  function readDelimitedPreviewTokenAt(source, startIndex, open, close, allowNewlines) {
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

  function readInlineMathTokenAt(source, startIndex) {
    const text = String(source || "");
    if (text[startIndex] === "\\" && text[startIndex + 1] === "(") {
      return readDelimitedPreviewTokenAt(text, startIndex, "\\(", "\\)", true);
    }
    if (text[startIndex] === "\\" && text[startIndex + 1] === "[") {
      return readDelimitedPreviewTokenAt(text, startIndex, "\\[", "\\]", true);
    }
    if (text[startIndex] === "$" && text[startIndex + 1] === "$") {
      return readDelimitedPreviewTokenAt(text, startIndex, "$$", "$$", true);
    }
    if (text[startIndex] === "$" && text[startIndex + 1] !== "$" && text[startIndex + 1] && !/\s/.test(text[startIndex + 1])) {
      const token = readDelimitedPreviewTokenAt(text, startIndex, "$", "$", false);
      if (token && token.raw.length > 2) return token;
    }
    return null;
  }

  function readBareUrlTokenAt(source, startIndex) {
    const text = String(source || "").slice(startIndex);
    const match = text.match(/^https?:\/\/[^\s<]+/i);
    if (!match) return null;
    return {
      type: "literal",
      raw: match[0],
      end: startIndex + match[0].length,
    };
  }

  function readAnnotationPreviewProtectedTokenAt(source, startIndex) {
    const text = String(source || "");
    if (startIndex < 0 || startIndex >= text.length) return null;

    if (text[startIndex] === "`") {
      const end = advancePastBacktickSpan(text, startIndex);
      return {
        type: "code",
        raw: text.slice(startIndex, end),
        end: end,
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

  function canOpenEmphasisDelimiter(source, startIndex, delimiter) {
    const text = String(source || "");
    if (text.slice(startIndex, startIndex + delimiter.length) !== delimiter) return false;
    const prev = startIndex > 0 ? text[startIndex - 1] : "";
    const next = text[startIndex + delimiter.length] || "";
    if (!next || /\s/.test(next)) return false;
    return !isWordChar(prev);
  }

  function canCloseEmphasisDelimiter(source, startIndex, delimiter) {
    const text = String(source || "");
    if (text.slice(startIndex, startIndex + delimiter.length) !== delimiter) return false;
    const prev = startIndex > 0 ? text[startIndex - 1] : "";
    const next = text[startIndex + delimiter.length] || "";
    if (!prev || /\s/.test(prev)) return false;
    return !isWordChar(next);
  }

  function readAnnotationEmphasisSpanAt(source, startIndex, delimiter, tagName) {
    const text = String(source || "");
    if (!canOpenEmphasisDelimiter(text, startIndex, delimiter)) return null;

    let index = startIndex + delimiter.length;
    while (index < text.length) {
      if (text[index] === "\\") {
        index = Math.min(text.length, index + 2);
        continue;
      }

      const protectedToken = readAnnotationPreviewProtectedTokenAt(text, index);
      if (protectedToken) {
        index = protectedToken.end;
        continue;
      }

      if (canCloseEmphasisDelimiter(text, index, delimiter)) {
        const inner = text.slice(startIndex + delimiter.length, index);
        return {
          end: index + delimiter.length,
          html: "<" + tagName + ">" + renderAnnotationPlainTextHtml(inner) + "</" + tagName + ">",
        };
      }

      index += 1;
    }

    return null;
  }

  function renderAnnotationCodeSpanHtml(rawToken) {
    const raw = String(rawToken || "");
    if (!raw || raw[0] !== "`") return escapeHtml(raw);

    let fenceLength = 1;
    while (raw[fenceLength] === "`") fenceLength += 1;
    const fence = "`".repeat(fenceLength);
    if (raw.length < fenceLength * 2 || raw.slice(raw.length - fenceLength) !== fence) {
      return escapeHtml(raw);
    }

    return "<code>" + escapeHtml(raw.slice(fenceLength, raw.length - fenceLength)) + "</code>";
  }

  function renderAnnotationPlainTextHtml(text) {
    const source = String(text || "");
    let out = "";
    let index = 0;

    while (index < source.length) {
      const strongMatch = readAnnotationEmphasisSpanAt(source, index, "**", "strong")
        || readAnnotationEmphasisSpanAt(source, index, "__", "strong");
      if (strongMatch) {
        out += strongMatch.html;
        index = strongMatch.end;
        continue;
      }

      const emphasisMatch = readAnnotationEmphasisSpanAt(source, index, "*", "em")
        || readAnnotationEmphasisSpanAt(source, index, "_", "em");
      if (emphasisMatch) {
        out += emphasisMatch.html;
        index = emphasisMatch.end;
        continue;
      }

      out += escapeHtml(source[index]);
      index += 1;
    }

    return out;
  }

  function renderPreviewAnnotationHtml(text) {
    const source = normalizePreviewAnnotationLabel(text);
    let out = "";
    let plainStart = 0;
    let index = 0;

    while (index < source.length) {
      const token = readAnnotationPreviewProtectedTokenAt(source, index);
      if (!token) {
        index += 1;
        continue;
      }

      if (index > plainStart) {
        out += renderAnnotationPlainTextHtml(source.slice(plainStart, index));
      }

      if (token.type === "code") {
        out += renderAnnotationCodeSpanHtml(token.raw);
      } else {
        out += escapeHtml(token.raw);
      }

      index = token.end;
      plainStart = index;
    }

    if (plainStart < source.length) {
      out += renderAnnotationPlainTextHtml(source.slice(plainStart));
    }

    return out;
  }

  function transformMarkdownOutsideFences(text, plainTransformer) {
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

  function hasAnnotationMarkers(text) {
    let found = false;
    transformMarkdownOutsideFences(text, function(segment) {
      if (!found && collectInlineAnnotationMarkers(segment).length > 0) {
        found = true;
      }
      return segment;
    });
    return found;
  }

  function stripAnnotationMarkers(text) {
    return transformMarkdownOutsideFences(text, function(segment) {
      return replaceInlineAnnotationMarkers(segment, function() { return ""; });
    });
  }

  function prepareMarkdownForPandocPreview(markdown, placeholderPrefix) {
    const placeholders = [];
    const prefix = typeof placeholderPrefix === "string" && placeholderPrefix
      ? placeholderPrefix
      : "PIMDANNOT";
    const prepared = transformMarkdownOutsideFences(markdown, function(segment) {
      return replaceInlineAnnotationMarkers(segment, function(marker) {
        const label = normalizePreviewAnnotationLabel(marker.body);
        if (!label) return "";
        const token = prefix + placeholders.length + "TOKEN";
        placeholders.push({ token: token, text: label, title: "[an: " + label + "]" });
        return token;
      });
    });
    return { markdown: prepared, placeholders: placeholders };
  }

  const helpers = Object.freeze({
    collectInlineAnnotationMarkers: collectInlineAnnotationMarkers,
    hasAnnotationMarkers: hasAnnotationMarkers,
    normalizePreviewAnnotationLabel: normalizePreviewAnnotationLabel,
    prepareMarkdownForPandocPreview: prepareMarkdownForPandocPreview,
    readInlineAnnotationMarkerAt: readInlineAnnotationMarkerAt,
    renderPreviewAnnotationHtml: renderPreviewAnnotationHtml,
    replaceInlineAnnotationMarkers: replaceInlineAnnotationMarkers,
    stripAnnotationMarkers: stripAnnotationMarkers,
    transformMarkdownOutsideFences: transformMarkdownOutsideFences,
  });

  globalThis.PiMarkdownPreviewAnnotationHelpers = helpers;
})();
