(function (window) {
  "use strict";

  function normalizeInput(value) {
    if (!value) return "";
    return value.normalize("NFKC").trim();
  }

  function chineseToPinyin(input) {
    if (window.pinyinPro && typeof window.pinyinPro.pinyin === "function") {
      try {
        var converted = window.pinyinPro.pinyin(input, {
          toneType: "none",
          type: "array"
        });
        if (Array.isArray(converted)) {
          return converted.join(" ");
        }
        if (typeof converted === "string") {
          return converted;
        }
      } catch (err) {
        // Ignore and use fallback.
      }
    }
    return input;
  }

  function slugifyTitle(title) {
    var normalized = normalizeInput(title);
    if (!normalized) return "";

    var pinyinText = chineseToPinyin(normalized);

    return pinyinText
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function fallbackSlug() {
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, "0");
    var mm = String(now.getMinutes()).padStart(2, "0");
    var ss = String(now.getSeconds()).padStart(2, "0");
    return "post-" + hh + mm + ss;
  }

  window.AdminSlug = {
    slugifyTitle: slugifyTitle,
    fallbackSlug: fallbackSlug
  };
})(window);
