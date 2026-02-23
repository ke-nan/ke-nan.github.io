(function (window, document) {
  "use strict";

  var api = window.AdminGithubApi;
  var slugApi = window.AdminSlug;

  if (!api || !slugApi) {
    throw new Error("Required scripts are missing.");
  }

  var cfg = api.mergeConfig();
  var keys = api.storageKeys();

  var state = {
    client: null,
    currentUser: "",
    posts: [],
    currentPath: "",
    currentSha: "",
    currentName: ""
  };

  var el = {
    status: document.getElementById("statusText"),
    postList: document.getElementById("postList"),
    search: document.getElementById("searchInput"),
    title: document.getElementById("titleInput"),
    subtitle: document.getElementById("subtitleInput"),
    tags: document.getElementById("tagsInput"),
    body: document.getElementById("bodyInput"),
    filename: document.getElementById("filenameDisplay"),
    preview: document.getElementById("previewPane"),
    newBtn: document.getElementById("newBtn"),
    saveBtn: document.getElementById("saveBtn"),
    deleteBtn: document.getElementById("deleteBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    uploadBtn: document.getElementById("uploadBtn"),
    deleteImageBtn: document.getElementById("deleteImageBtn"),
    filePicker: document.getElementById("filePicker"),
    userLabel: document.getElementById("userLabel"),
    mdButtons: document.querySelectorAll("[data-md-action]")
  };

  function setStatus(message, isError) {
    el.status.textContent = message;
    el.status.className = isError ? "status error" : "status ok";
  }

  function escapeHtml(value) {
    return (value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toLocalDateString(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function toDayFolder(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return "" + y + m + d;
  }

  function nowTimeToken() {
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, "0");
    var mm = String(now.getMinutes()).padStart(2, "0");
    var ss = String(now.getSeconds()).padStart(2, "0");
    return hh + mm + ss;
  }

  function randomToken() {
    return String(Math.floor(Math.random() * 9000) + 1000);
  }

  function stripQuote(value) {
    var text = (value || "").trim();
    if (text.length >= 2) {
      var first = text[0];
      var last = text[text.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return text.slice(1, -1);
      }
    }
    return text;
  }

  function parseTags(raw) {
    return (raw || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(function (item) {
        return item.length > 0;
      });
  }

  function tagsToInput(tags) {
    return (tags || []).join(", ");
  }

  function parseFrontMatter(text) {
    var result = {
      meta: {
        title: "",
        subtitle: "",
        author: cfg.DEFAULT_AUTHOR,
        tags: []
      },
      body: text || ""
    };

    if (!text || text.slice(0, 3) !== "---") {
      return result;
    }

    var normalized = text.replace(/\r\n/g, "\n");
    var endIndex = normalized.indexOf("\n---", 3);
    if (endIndex < 0) {
      return result;
    }

    var rawMeta = normalized.slice(4, endIndex + 1);
    var body = normalized.slice(endIndex + 4).replace(/^\n/, "");
    var lines = rawMeta.split("\n");

    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      var tagsMatch = line.match(/^tags:\s*(.*)$/);
      if (tagsMatch) {
        var rest = (tagsMatch[1] || "").trim();
        var tags = [];
        if (rest.startsWith("[") && rest.endsWith("]")) {
          tags = rest
            .slice(1, -1)
            .split(",")
            .map(function (item) {
              return stripQuote(item);
            })
            .filter(function (item) {
              return item.length > 0;
            });
        } else if (!rest) {
          i += 1;
          while (i < lines.length) {
            var itemLine = lines[i];
            var itemMatch = itemLine.match(/^\s*-\s*(.+)$/);
            if (!itemMatch) {
              i -= 1;
              break;
            }
            tags.push(stripQuote(itemMatch[1]));
            i += 1;
          }
        }
        result.meta.tags = tags;
        continue;
      }

      var match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!match) {
        continue;
      }
      var key = match[1];
      var value = stripQuote(match[2]);
      if (key === "title") result.meta.title = value;
      if (key === "subtitle") result.meta.subtitle = value;
      if (key === "author") result.meta.author = value || cfg.DEFAULT_AUTHOR;
    }

    result.body = body;
    return result;
  }

  function yamlSafeDoubleQuote(value) {
    return (value || "").replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
  }

  function buildPostContent(draft) {
    var lines = [
      "---",
      "layout: post",
      "title: \"" + yamlSafeDoubleQuote(draft.title) + "\"",
      "subtitle: \"" + yamlSafeDoubleQuote(draft.subtitle) + "\"",
      "author: \"" + yamlSafeDoubleQuote(draft.author || cfg.DEFAULT_AUTHOR) + "\""
    ];

    if (draft.tags && draft.tags.length > 0) {
      lines.push("tags:");
      draft.tags.forEach(function (tag) {
        lines.push("  - " + tag);
      });
    } else {
      lines.push("tags: []");
    }

    lines.push("---");
    lines.push("");

    var body = draft.body || "";
    return lines.join("\n") + body;
  }

  async function ensureUniquePostPath(dateText, baseSlug) {
    var cleanSlug = baseSlug || slugApi.fallbackSlug();
    var index = 1;

    while (index < 1000) {
      var suffix = index === 1 ? "" : "-" + index;
      var filename = dateText + "-" + cleanSlug + suffix + ".md";
      var path = "_posts/" + filename;
      var check = await state.client.exists(path);
      if (!check.exists) {
        return { filename: filename, path: path };
      }
      index += 1;
    }

    throw new Error("Unable to allocate a unique post filename.");
  }

  function setEditorFromDraft(draft, path, sha) {
    el.title.value = draft.title || "";
    el.subtitle.value = draft.subtitle || "";
    el.tags.value = tagsToInput(draft.tags || []);
    el.body.value = draft.body || "";

    state.currentPath = path || "";
    state.currentSha = sha || "";
    state.currentName = path ? path.split("/").pop() : "";

    el.filename.textContent = state.currentName || "(new post)";
    el.deleteBtn.disabled = !state.currentPath;

    renderPreview();
  }

  function makeCurrentDraft() {
    return {
      title: el.title.value.trim(),
      subtitle: el.subtitle.value.trim(),
      author: cfg.DEFAULT_AUTHOR,
      tags: parseTags(el.tags.value),
      body: el.body.value
    };
  }

  function renderPostList(items) {
    el.postList.innerHTML = "";
    items.forEach(function (item) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "post-item" + (item.path === state.currentPath ? " active" : "");
      button.textContent = item.name;
      button.addEventListener("click", function () {
        loadPost(item.path);
      });
      el.postList.appendChild(button);
    });

    if (items.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty-note";
      empty.textContent = "No posts found.";
      el.postList.appendChild(empty);
    }
  }

  function filterPostList() {
    var keyword = el.search.value.trim().toLowerCase();
    var filtered = state.posts.filter(function (item) {
      return item.name.toLowerCase().indexOf(keyword) >= 0;
    });
    renderPostList(filtered);
  }

  async function refreshPosts() {
    var all = await state.client.listContents("_posts");
    state.posts = (all || [])
      .filter(function (item) {
        return item.type === "file" && /\.md$/i.test(item.name);
      })
      .sort(function (a, b) {
        return b.name.localeCompare(a.name);
      })
      .map(function (item) {
        return {
          name: item.name,
          path: item.path,
          sha: item.sha
        };
      });

    filterPostList();
  }

  async function loadPost(path) {
    try {
      setStatus("Loading " + path + " ...", false);
      var file = await state.client.getContent(path);
      var parsed = parseFrontMatter(file.decoded);
      setEditorFromDraft(
        {
          title: parsed.meta.title,
          subtitle: parsed.meta.subtitle,
          tags: parsed.meta.tags,
          body: parsed.body
        },
        file.path,
        file.sha
      );
      filterPostList();
      setStatus("Loaded " + file.name, false);
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function clearDraft() {
    setEditorFromDraft(
      {
        title: "",
        subtitle: "Hello World, Hello Blog",
        tags: [],
        body: ""
      },
      "",
      ""
    );
    setStatus("Ready for a new post.", false);
    filterPostList();
  }

  async function savePost() {
    var draft = makeCurrentDraft();
    if (!draft.title) {
      setStatus("Title is required.", true);
      return;
    }

    try {
      el.saveBtn.disabled = true;
      setStatus("Publishing...", false);

      var content = buildPostContent(draft);
      var path = state.currentPath;
      var filename = "";
      var sha = state.currentSha;

      if (!path) {
        var dateText = toLocalDateString(new Date());
        var slug = slugApi.slugifyTitle(draft.title) || slugApi.fallbackSlug();
        var unique = await ensureUniquePostPath(dateText, slug);
        path = unique.path;
        filename = unique.filename;
        sha = "";
      } else {
        filename = path.split("/").pop();
      }

      var message = sha ? "post: update " + filename : "post: create " + filename;
      var result = await state.client.putTextFile(path, content, message, sha || undefined);

      state.currentPath = path;
      state.currentName = filename;
      state.currentSha = result.content ? result.content.sha : sha;
      el.filename.textContent = filename;
      el.deleteBtn.disabled = false;

      await refreshPosts();
      filterPostList();
      setStatus("Published " + filename, false);
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      el.saveBtn.disabled = false;
    }
  }

  async function deleteCurrentPost() {
    if (!state.currentPath || !state.currentSha) {
      setStatus("No saved post selected.", true);
      return;
    }

    var filename = state.currentPath.split("/").pop();
    var ok = window.confirm("Delete " + filename + " permanently?");
    if (!ok) {
      return;
    }

    try {
      el.deleteBtn.disabled = true;
      setStatus("Deleting " + filename + " ...", false);
      await state.client.deleteFile(state.currentPath, state.currentSha, "post: delete " + filename);
      clearDraft();
      await refreshPosts();
      setStatus("Deleted " + filename, false);
    } catch (err) {
      setStatus(err.message, true);
      el.deleteBtn.disabled = false;
    }
  }

  function normalizeImageRepoPath(rawPath) {
    var input = (rawPath || "").trim();
    if (!input) return "";
    if (input.indexOf("http://") === 0 || input.indexOf("https://") === 0) {
      try {
        var url = new URL(input);
        input = url.pathname;
      } catch (err) {
        return "";
      }
    }

    if (input.indexOf(cfg.SITE_BASEURL) === 0 && cfg.SITE_BASEURL) {
      input = input.slice(cfg.SITE_BASEURL.length);
    }

    if (input[0] === "/") {
      input = input.slice(1);
    }

    if (!/^assets\/img\//.test(input)) {
      return "";
    }

    return input;
  }

  async function deleteImageByPrompt() {
    var rawPath = window.prompt("Input image path to delete (example: /assets/img/20260223/demo.png)");
    if (!rawPath) return;

    var repoPath = normalizeImageRepoPath(rawPath);
    if (!repoPath) {
      setStatus("Invalid image path. It must start with /assets/img/", true);
      return;
    }

    try {
      setStatus("Checking image...", false);
      var check = await state.client.exists(repoPath);
      if (!check.exists) {
        setStatus("Image not found: " + repoPath, true);
        return;
      }

      var ok = window.confirm("Delete image permanently?\n" + repoPath);
      if (!ok) return;

      var imageName = repoPath.split("/").pop();
      await state.client.deleteFile(repoPath, check.content.sha, "image: delete " + repoPath);
      setStatus("Deleted image " + imageName, false);
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function insertAtCursor(text) {
    var textarea = el.body;
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var current = textarea.value;
    textarea.value = current.slice(0, start) + text + current.slice(end);
    var next = start + text.length;
    textarea.selectionStart = next;
    textarea.selectionEnd = next;
    textarea.focus();
    renderPreview();
  }

  function replaceSelection(replacer) {
    var textarea = el.body;
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var current = textarea.value;
    var selected = current.slice(start, end);
    var replaced = replacer(selected, start, end, current);
    var nextText = current.slice(0, start) + replaced + current.slice(end);
    textarea.value = nextText;
    textarea.selectionStart = start;
    textarea.selectionEnd = start + replaced.length;
    textarea.focus();
    renderPreview();
  }

  function wrapSelection(prefix, suffix, placeholder) {
    replaceSelection(function (selected) {
      var content = selected || placeholder || "";
      return prefix + content + suffix;
    });
  }

  function prefixLines(prefix, placeholder) {
    replaceSelection(function (selected) {
      var content = selected || placeholder || "";
      var lines = content.split("\n");
      return lines
        .map(function (line) {
          return prefix + line;
        })
        .join("\n");
    });
  }

  function applyMarkdownAction(action) {
    switch (action) {
      case "h1":
        prefixLines("# ", "一级标题");
        break;
      case "h2":
        prefixLines("## ", "二级标题");
        break;
      case "h3":
        prefixLines("### ", "三级标题");
        break;
      case "paragraph":
        insertAtCursor("\n\n正文内容\n\n");
        break;
      case "quote":
        prefixLines("> ", "引用内容");
        break;
      case "bold":
        wrapSelection("**", "**", "加粗文本");
        break;
      case "italic":
        wrapSelection("*", "*", "斜体文本");
        break;
      case "inline-code":
        wrapSelection("`", "`", "code");
        break;
      case "code-block":
        wrapSelection("```\n", "\n```", "code");
        break;
      case "ul":
        prefixLines("- ", "列表项");
        break;
      case "ol":
        prefixLines("1. ", "列表项");
        break;
      case "link":
        wrapSelection("[", "](https://example.com)", "链接文本");
        break;
      case "image":
        insertAtCursor("![](/assets/img/)");
        break;
      default:
        break;
    }
  }

  function mimeToExt(type) {
    var map = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif"
    };
    return map[type] || "png";
  }

  async function uploadImageBlob(blob) {
    var title = el.title.value.trim();
    var slug = slugApi.slugifyTitle(title) || slugApi.fallbackSlug();
    var folder = toDayFolder(new Date());
    var ext = mimeToExt(blob.type);
    var filename = slug + "-" + nowTimeToken() + "-" + randomToken() + "." + ext;
    var repoPath = "assets/img/" + folder + "/" + filename;

    try {
      setStatus("Uploading image...", false);
      var bytes = new Uint8Array(await blob.arrayBuffer());
      await state.client.upsertBinaryFile(repoPath, bytes, "image: upload " + repoPath);
      var publicPath = "/" + repoPath;
      var markdown = "![](" + publicPath + ")";
      insertAtCursor(markdown);
      setStatus("Uploaded " + filename, false);
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function renderPreview() {
    var source = el.body.value || "";
    if (window.marked && typeof window.marked.parse === "function") {
      el.preview.innerHTML = window.marked.parse(source);
    } else {
      el.preview.innerHTML = "<pre>" + escapeHtml(source) + "</pre>";
    }
  }

  function logout() {
    sessionStorage.removeItem(keys.token);
    sessionStorage.removeItem(keys.user);
    window.location.href = "./login.html";
  }

  async function boot() {
    var token = sessionStorage.getItem(keys.token);
    if (!token) {
      window.location.href = "./login.html";
      return;
    }

    state.client = api.createClient(token);

    try {
      var me = await state.client.getUser();
      if (cfg.ADMIN_GITHUB_USER && me.login.toLowerCase() !== cfg.ADMIN_GITHUB_USER.toLowerCase()) {
        throw new Error("User is not allowed for this admin page.");
      }
      state.currentUser = me.login;
      el.userLabel.textContent = me.login;
      setStatus("Connected as " + me.login, false);

      clearDraft();
      await refreshPosts();
    } catch (err) {
      sessionStorage.removeItem(keys.token);
      sessionStorage.removeItem(keys.user);
      setStatus(err.message, true);
      setTimeout(function () {
        window.location.href = "./login.html";
      }, 900);
    }
  }

  el.search.addEventListener("input", filterPostList);
  el.newBtn.addEventListener("click", clearDraft);
  el.saveBtn.addEventListener("click", savePost);
  el.deleteBtn.addEventListener("click", deleteCurrentPost);
  el.logoutBtn.addEventListener("click", logout);
  el.uploadBtn.addEventListener("click", function () {
    el.filePicker.click();
  });
  el.deleteImageBtn.addEventListener("click", deleteImageByPrompt);
  el.mdButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      applyMarkdownAction(button.getAttribute("data-md-action"));
    });
  });

  el.filePicker.addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setStatus("Only image files are supported.", true);
      return;
    }
    uploadImageBlob(file);
    el.filePicker.value = "";
  });

  el.body.addEventListener("input", renderPreview);

  el.body.addEventListener("paste", function (event) {
    var items = event.clipboardData && event.clipboardData.items;
    if (!items || !items.length) return;

    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      if (item.kind === "file" && /^image\//.test(item.type)) {
        var blob = item.getAsFile();
        if (blob) {
          event.preventDefault();
          uploadImageBlob(blob);
          return;
        }
      }
    }
  });

  boot();
})(window, document);
