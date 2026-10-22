import { describe, expect, it } from "vitest";
import { isRichTextEmpty, sanitizeRichText } from "./richTextSanitize";

describe("sanitizeRichText", () => {
  it("keeps the formatting the editor produces", () => {
    const html = "<h3>Área Lenguaje</h3><ul><li><b>Lee</b> y <i>escribe</i></li></ul>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("keeps only text-align from the style attribute", () => {
    expect(sanitizeRichText('<div style="text-align: center; color: red">Hola</div>')).toBe(
      '<div style="text-align:center">Hola</div>',
    );
  });

  it("removes scripts, images and event handlers", () => {
    const out = sanitizeRichText('<p onmouseover="x()">A</p><script>bad()</script><img src="x" onerror="y()">');
    expect(out).toBe("<p>A</p>");
  });

  it("unwraps unknown elements and keeps their text", () => {
    expect(sanitizeRichText('<a href="javascript:x()">enlace</a> <font color="red">rojo</font>')).toBe("enlace rojo");
  });

  it("returns an empty string for empty input", () => {
    expect(sanitizeRichText("")).toBe("");
    expect(sanitizeRichText(null)).toBe("");
  });
});

describe("isRichTextEmpty", () => {
  it.each([null, "", "<br>", "<div><br></div>", "&nbsp;", "<p> &nbsp; </p>"])("treats %j as empty", (html) => {
    expect(isRichTextEmpty(html)).toBe(true);
  });

  it("detects visible text", () => {
    expect(isRichTextEmpty("<p>Lee</p>")).toBe(false);
  });
});
