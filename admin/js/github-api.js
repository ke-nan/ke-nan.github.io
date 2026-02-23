(function (window) {
  "use strict";

  function mergeConfig() {
    var defaults = {
      GITHUB_OWNER: "ke-nan",
      GITHUB_REPO: "ke-nan.github.io",
      GITHUB_BRANCH: "master",
      ADMIN_GITHUB_USER: "",
      DEFAULT_AUTHOR: "Haike Nan",
      SITE_BASEURL: ""
    };
    var runtime = window.ADMIN_CONFIG || {};
    var merged = {};
    Object.keys(defaults).forEach(function (key) {
      merged[key] = defaults[key];
    });
    Object.keys(runtime).forEach(function (key) {
      merged[key] = runtime[key];
    });
    return merged;
  }

  function joinUrl(base, path) {
    if (!path) return base;
    return base.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
  }

  function encodeRepoPath(path) {
    return path
      .split("/")
      .map(function (segment) {
        return encodeURIComponent(segment);
      })
      .join("/");
  }

  function bytesToBase64(bytes) {
    var chunkSize = 0x8000;
    var result = "";
    for (var i = 0; i < bytes.length; i += chunkSize) {
      var chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      result += String.fromCharCode.apply(null, chunk);
    }
    return btoa(result);
  }

  function base64ToUtf8(content) {
    var cleaned = (content || "").replace(/\n/g, "");
    var binary = atob(cleaned);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  function utf8ToBase64(text) {
    var bytes = new TextEncoder().encode(text || "");
    return bytesToBase64(bytes);
  }

  function GithubRepoClient(options) {
    this.owner = options.owner;
    this.repo = options.repo;
    this.branch = options.branch || "master";
    this.token = options.token;
    this.baseApi = "https://api.github.com";
  }

  GithubRepoClient.prototype._headers = function () {
    return {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + this.token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
  };

  GithubRepoClient.prototype._request = async function (url, init) {
    var response = await fetch(url, init);
    if (response.status === 204) {
      return null;
    }

    var payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      payload = null;
    }

    if (!response.ok) {
      var message = payload && payload.message ? payload.message : "GitHub API request failed";
      var error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  };

  GithubRepoClient.prototype._contentsUrl = function (path, withRef) {
    var encodedPath = encodeRepoPath(path);
    var base = this.baseApi + "/repos/" + encodeURIComponent(this.owner) + "/" + encodeURIComponent(this.repo) + "/contents/" + encodedPath;
    if (withRef) {
      return base + "?ref=" + encodeURIComponent(this.branch);
    }
    return base;
  };

  GithubRepoClient.prototype.getUser = async function () {
    return this._request(this.baseApi + "/user", {
      method: "GET",
      headers: this._headers()
    });
  };

  GithubRepoClient.prototype.listContents = async function (path) {
    return this._request(this._contentsUrl(path, true), {
      method: "GET",
      headers: this._headers()
    });
  };

  GithubRepoClient.prototype.getContent = async function (path) {
    var data = await this._request(this._contentsUrl(path, true), {
      method: "GET",
      headers: this._headers()
    });

    return {
      name: data.name,
      path: data.path,
      sha: data.sha,
      size: data.size,
      encoding: data.encoding,
      downloadUrl: data.download_url,
      content: data.content,
      decoded: data.encoding === "base64" ? base64ToUtf8(data.content) : data.content
    };
  };

  GithubRepoClient.prototype.exists = async function (path) {
    try {
      var content = await this.getContent(path);
      return { exists: true, content: content };
    } catch (err) {
      if (err.status === 404) {
        return { exists: false, content: null };
      }
      throw err;
    }
  };

  GithubRepoClient.prototype.putTextFile = async function (path, text, message, sha) {
    var body = {
      message: message,
      content: utf8ToBase64(text),
      branch: this.branch
    };

    if (sha) {
      body.sha = sha;
    }

    return this._request(this._contentsUrl(path, false), {
      method: "PUT",
      headers: this._headers(),
      body: JSON.stringify(body)
    });
  };

  GithubRepoClient.prototype.putBinaryFile = async function (path, bytes, message, sha) {
    var body = {
      message: message,
      content: bytesToBase64(bytes),
      branch: this.branch
    };

    if (sha) {
      body.sha = sha;
    }

    return this._request(this._contentsUrl(path, false), {
      method: "PUT",
      headers: this._headers(),
      body: JSON.stringify(body)
    });
  };

  GithubRepoClient.prototype.deleteFile = async function (path, sha, message) {
    var body = {
      message: message,
      branch: this.branch,
      sha: sha
    };

    return this._request(this._contentsUrl(path, false), {
      method: "DELETE",
      headers: this._headers(),
      body: JSON.stringify(body)
    });
  };

  GithubRepoClient.prototype.upsertTextFile = async function (path, text, createMessage, updateMessage) {
    var check = await this.exists(path);
    var sha = check.exists ? check.content.sha : null;
    var message = check.exists ? updateMessage : createMessage;
    return this.putTextFile(path, text, message, sha);
  };

  GithubRepoClient.prototype.upsertBinaryFile = async function (path, bytes, message) {
    var check = await this.exists(path);
    var sha = check.exists ? check.content.sha : null;
    return this.putBinaryFile(path, bytes, message, sha);
  };

  function createClient(token) {
    var cfg = mergeConfig();
    return new GithubRepoClient({
      owner: cfg.GITHUB_OWNER,
      repo: cfg.GITHUB_REPO,
      branch: cfg.GITHUB_BRANCH,
      token: token
    });
  }

  function storageKeys() {
    return {
      token: "admin.github.token",
      user: "admin.github.user"
    };
  }

  window.AdminGithubApi = {
    mergeConfig: mergeConfig,
    createClient: createClient,
    storageKeys: storageKeys,
    helpers: {
      utf8ToBase64: utf8ToBase64,
      base64ToUtf8: base64ToUtf8,
      joinUrl: joinUrl
    }
  };
})(window);
