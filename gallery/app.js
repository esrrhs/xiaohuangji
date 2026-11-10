(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.XhjGallery = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORMAT_LABELS = {
    gif: "GIF 动图",
    png: "PNG",
    jpg: "JPG",
    webp: "WebP",
  };

  function normalize(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function formatLabel(format) {
    return FORMAT_LABELS[format] || String(format || "").toUpperCase();
  }

  function buildAliasIndex(vocabulary) {
    const map = {};
    Object.keys(vocabulary || {}).forEach(function (tag) {
      const meta = vocabulary[tag] || {};
      const aliases = [tag].concat(meta.aliases || []);
      aliases.forEach(function (alias) {
        const key = normalize(alias);
        if (!key) return;
        if (!map[key]) map[key] = [];
        if (map[key].indexOf(tag) === -1) map[key].push(tag);
      });
    });
    return map;
  }

  function itemHaystack(item, vocabulary) {
    const parts = [
      item.file,
      item.id,
      item.format,
      formatLabel(item.format),
      item.title || "",
    ].concat(item.tags || []);
    (item.tags || []).forEach(function (tag) {
      const meta = (vocabulary || {})[tag];
      if (meta && meta.aliases) parts.push.apply(parts, meta.aliases);
    });
    return normalize(parts.join(" "));
  }

  function filterItems(items, filters, vocabulary) {
    const query = normalize(filters && filters.query);
    const tokens = query ? query.split(" ").filter(Boolean) : [];
    const format = (filters && filters.format) || "";
    const tags = (filters && filters.tags) || [];
    const untaggedOnly = !!(filters && filters.untaggedOnly);

    return (items || []).filter(function (item) {
      if (format && item.format !== format) return false;
      if (untaggedOnly && item.tagged) return false;
      if (tags.length) {
        const has = tags.some(function (tag) {
          return (item.tags || []).indexOf(tag) !== -1;
        });
        if (!has) return false;
      }
      if (!tokens.length) return true;
      const hay = itemHaystack(item, vocabulary);
      return tokens.every(function (token) {
        return hay.indexOf(token) !== -1;
      });
    });
  }

  function pickRandom(items, currentId) {
    if (!items || !items.length) return null;
    if (items.length === 1) return items[0];
    const pool = currentId
      ? items.filter(function (item) { return item.id !== currentId; })
      : items;
    const source = pool.length ? pool : items;
    const index = Math.floor(Math.random() * source.length);
    return source[index];
  }

  function usedTags(items, vocabulary) {
    const counts = {};
    (items || []).forEach(function (item) {
      (item.tags || []).forEach(function (tag) {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    const groups = {};
    Object.keys(counts)
      .sort(function (a, b) { return a.localeCompare(b, "zh-CN"); })
      .forEach(function (tag) {
        const group = (vocabulary[tag] && vocabulary[tag].group) || "其他";
        if (!groups[group]) groups[group] = [];
        groups[group].push({ tag: tag, count: counts[tag] });
      });
    return groups;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function createEl(tag, attrs, text) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "className") el.className = attrs[key];
        else if (key === "dataset") {
          Object.keys(attrs.dataset).forEach(function (dataKey) {
            el.dataset[dataKey] = attrs.dataset[dataKey];
          });
        } else if (attrs[key] !== undefined && attrs[key] !== null) {
          el.setAttribute(key, attrs[key]);
        }
      });
    }
    if (text != null) el.textContent = text;
    return el;
  }

  function parseStateFromUrl() {
    const params = new URLSearchParams(location.search);
    return {
      query: params.get("q") || "",
      format: params.get("format") || "",
      tags: (params.get("tag") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      untaggedOnly: params.get("untagged") === "1",
    };
  }

  function writeStateToUrl(state, replace) {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.format) params.set("format", state.format);
    if (state.tags && state.tags.length) params.set("tag", state.tags.join(","));
    if (state.untaggedOnly) params.set("untagged", "1");
    if (state.taggedOnly) params.set("tagged", "1");
    const search = params.toString();
    const url = location.pathname + (search ? "?" + search : "") + location.hash;
    const fn = replace ? history.replaceState : history.pushState;
    fn.call(history, state, "", url);
  }

  function mount(options) {
    const opts = options || {};
    const doc = opts.document || document;
    const win = doc.defaultView || opts.window || (typeof window !== "undefined" ? window : null);
    const manifestUrl = opts.manifestUrl || "gallery/manifest.json?v=2";
    const state = {
      query: "",
      format: "",
      tags: [],
      untaggedOnly: false,
    };
    let manifest = null;
    let filtered = [];
    let previewIndex = -1;
    let lastFocus = null;

    const els = {
      search: doc.getElementById("search"),
      hint: doc.getElementById("search-hint"),
      format: doc.getElementById("format-filters"),
      statusFilters: doc.getElementById("status-filters"),
      tags: doc.getElementById("tag-filters"),
      status: doc.getElementById("status"),
      error: doc.getElementById("error"),
      empty: doc.getElementById("empty"),
      grid: doc.getElementById("grid"),
      random: doc.getElementById("random-btn"),
      clear: doc.getElementById("clear-btn"),
      lightbox: doc.getElementById("lightbox"),
      lightboxImage: doc.getElementById("lightbox-image"),
      lightboxTitle: doc.getElementById("lightbox-title"),
      lightboxMeta: doc.getElementById("lightbox-meta"),
      lightboxTags: doc.getElementById("lightbox-tags"),
      lightboxClose: doc.getElementById("lightbox-close"),
      lightboxPrev: doc.getElementById("lightbox-prev"),
      lightboxNext: doc.getElementById("lightbox-next"),
      copyName: doc.getElementById("copy-name"),
      openOriginal: doc.getElementById("open-original"),
    };

    function showError(message) {
      els.error.hidden = false;
      els.error.textContent = message;
      els.grid.innerHTML = "";
      els.status.textContent = "";
    }

    function renderHint() {
      if (!manifest) return;
      if (!manifest.untaggedCount) {
        els.hint.textContent =
          "格式分类和语义搜索均已覆盖全部 " + manifest.count +
          " 张。语义标签为人工查看后标注，不能从哈希文件名推断含义。";
      } else {
        els.hint.textContent =
          "格式分类覆盖全部 " + manifest.count + " 张。语义搜索覆盖已人工标注的 " +
          manifest.taggedCount + " 张；另有 " + manifest.untaggedCount +
          " 张因无法确认含义仍为「未标注」，不能从哈希文件名推断中文含义。";
      }
    }

    function chip(label, pressed, dataset, count) {
      const btn = createEl("button", {
        type: "button",
        className: "chip",
        "aria-pressed": pressed ? "true" : "false",
        dataset: dataset,
      }, label);
      if (count != null) {
        btn.appendChild(createEl("span", { className: "count" }, String(count)));
      }
      return btn;
    }

    function renderFilters() {
      const formats = manifest.formats || {};
      els.format.innerHTML = "";
      els.format.appendChild(chip("全部格式", !state.format, { format: "" }, manifest.count));
      Object.keys(formats).forEach(function (fmt) {
        els.format.appendChild(
          chip(formatLabel(fmt), state.format === fmt, { format: fmt }, formats[fmt])
        );
      });

      els.statusFilters.innerHTML = "";
      els.statusFilters.appendChild(
        chip("已标注", !!state.taggedOnly, { tagged: "1" }, manifest.taggedCount)
      );
      els.statusFilters.appendChild(
        chip("未标注", state.untaggedOnly, { untagged: "1" }, manifest.untaggedCount)
      );

      els.tags.innerHTML = "";
      const groups = usedTags(manifest.items, manifest.vocabulary);
      const groupOrder = ["情绪", "动作", "场景", "其他"];
      const names = Object.keys(groups).sort(function (a, b) {
        const ia = groupOrder.indexOf(a);
        const ib = groupOrder.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      names.forEach(function (group) {
        const row = createEl("div", { className: "tag-row" });
        row.appendChild(createEl("div", { className: "group-label" }, group));
        groups[group].forEach(function (entry) {
          row.appendChild(
            chip(entry.tag, state.tags.indexOf(entry.tag) !== -1, { tag: entry.tag }, entry.count)
          );
        });
        els.tags.appendChild(row);
      });
      updateTagSummary();
    }

    function updateTagSummary() {
      const el = doc.getElementById("tag-summary");
      if (!el) return;
      const selected = state.tags.length;
      el.textContent = selected ? ("语义标签（已选 " + selected + "）") : "语义标签";
    }

    function initTagPanel() {
      const panel = doc.getElementById("tag-panel");
      if (!panel || typeof panel.open === "undefined") return;
      const wide = win && win.matchMedia ? win.matchMedia("(min-width: 701px)") : null;
      if (wide && wide.matches) panel.open = true;
      if (wide && wide.addEventListener) {
        wide.addEventListener("change", function (event) {
          panel.open = event.matches;
        });
      } else if (wide && wide.addListener) {
        wide.addListener(function (event) {
          panel.open = event.matches;
        });
      }
    }

    function effectiveFilters() {
      return {
        query: state.query,
        format: state.format,
        tags: state.taggedOnly && !state.tags.length ? [] : state.tags,
        untaggedOnly: state.untaggedOnly,
        taggedOnly: state.taggedOnly,
      };
    }

    function apply() {
      const filters = effectiveFilters();
      filtered = filterItems(manifest.items, filters, manifest.vocabulary);
      if (state.taggedOnly) {
        filtered = filtered.filter(function (item) { return item.tagged; });
      }
      els.status.textContent =
        "显示 " + filtered.length + " / " + manifest.count +
        "（已标注 " + manifest.taggedCount + "）";
      els.empty.hidden = filtered.length !== 0;
      els.grid.innerHTML = "";
      const frag = doc.createDocumentFragment();
      filtered.forEach(function (item, index) {
        const card = createEl("button", {
          type: "button",
          className: "card",
          "data-id": item.id,
          "data-index": String(index),
          "aria-label": (item.title || item.file) + "，" + formatLabel(item.format),
        });
        const thumb = createEl("span", { className: "card-thumb" });
        const img = createEl("img", {
          alt: item.title || "",
          loading: index < 24 ? "eager" : "lazy",
          decoding: "async",
          src: item.src,
          width: String(item.width || 80),
          height: String(item.height || 80),
        });
        img.addEventListener("error", function () {
          thumb.classList.add("is-error");
        });
        thumb.appendChild(img);
        card.appendChild(thumb);
        card.appendChild(createEl("span", { className: "badge" }, item.format));
        if (item.tagged) card.appendChild(createEl("span", { className: "tag-dot" }, "标"));
        frag.appendChild(card);
      });
      els.grid.appendChild(frag);
    }

    function syncUrl() {
      writeStateToUrl({
        query: state.query,
        format: state.format,
        tags: state.tags,
        untaggedOnly: state.untaggedOnly,
        taggedOnly: !!state.taggedOnly,
      }, true);
    }

    function setFromUrl() {
      const next = parseStateFromUrl();
      state.query = next.query;
      state.format = next.format;
      state.tags = next.tags;
      state.untaggedOnly = next.untaggedOnly;
      state.taggedOnly = new URLSearchParams(location.search).get("tagged") === "1";
      if (els.search) els.search.value = state.query;
    }

    function closePreview() {
      if (els.lightbox.hidden) return;
      els.lightbox.hidden = true;
      doc.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function openPreview(index) {
      if (index < 0 || index >= filtered.length) return;
      previewIndex = index;
      const item = filtered[index];
      els.lightbox.hidden = false;
      doc.body.style.overflow = "hidden";
      els.lightboxImage.src = item.src;
      els.lightboxImage.alt = item.title || item.file;
      els.lightboxTitle.textContent = item.title || (item.tagged ? item.tags.join("、") : "未标注");
      els.lightboxMeta.textContent =
        item.file + " · " + formatLabel(item.format) +
        (item.width && item.height ? " · " + item.width + "×" + item.height : "") +
        " · " + formatBytes(item.bytes || 0) +
        (item.frames > 1 ? " · " + item.frames + " 帧" : "");
      els.lightboxTags.innerHTML = "";
      if (item.tagged) {
        item.tags.forEach(function (tag) {
          els.lightboxTags.appendChild(createEl("span", null, tag));
        });
      } else {
        els.lightboxTags.appendChild(createEl("span", null, "未标注"));
      }
      els.openOriginal.href = item.src;
      els.lightboxPrev.disabled = index <= 0;
      els.lightboxNext.disabled = index >= filtered.length - 1;
      els.lightboxClose.focus();
    }

    function onKey(event) {
      if (els.lightbox.hidden) {
        if (event.key === "Escape" && (state.query || state.format || state.tags.length || state.untaggedOnly || state.taggedOnly)) {
          // don't hijack Escape in the page search box unless wanted
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closePreview();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        openPreview(previewIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        openPreview(previewIndex + 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        openPreview(0);
      } else if (event.key === "End") {
        event.preventDefault();
        openPreview(filtered.length - 1);
      }
    }

    function wire() {
      els.format.addEventListener("click", function (event) {
        const btn = event.target.closest("[data-format]");
        if (!btn) return;
        state.format = btn.dataset.format || "";
        renderFilters();
        apply();
        syncUrl();
      });
      els.statusFilters.addEventListener("click", function (event) {
        const untagged = event.target.closest("[data-untagged]");
        const tagged = event.target.closest("[data-tagged]");
        if (untagged) {
          state.untaggedOnly = !state.untaggedOnly;
          if (state.untaggedOnly) {
            state.taggedOnly = false;
            state.tags = [];
          }
        } else if (tagged) {
          state.taggedOnly = !state.taggedOnly;
          if (state.taggedOnly) state.untaggedOnly = false;
        } else {
          return;
        }
        renderFilters();
        apply();
        syncUrl();
      });
      els.tags.addEventListener("click", function (event) {
        const btn = event.target.closest("[data-tag]");
        if (!btn) return;
        const tag = btn.dataset.tag;
        const idx = state.tags.indexOf(tag);
        if (idx === -1) state.tags.push(tag);
        else state.tags.splice(idx, 1);
        if (state.tags.length) {
          state.untaggedOnly = false;
          state.taggedOnly = false;
        }
        renderFilters();
        apply();
        syncUrl();
      });
      let timer = null;
      els.search.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          state.query = els.search.value;
          apply();
          syncUrl();
        }, 120);
      });
      els.clear.addEventListener("click", function () {
        state.query = "";
        state.format = "";
        state.tags = [];
        state.untaggedOnly = false;
        state.taggedOnly = false;
        els.search.value = "";
        renderFilters();
        apply();
        syncUrl();
        els.search.focus();
      });
      els.random.addEventListener("click", function () {
        if (!filtered.length) {
          els.empty.hidden = false;
          return;
        }
        const current = previewIndex >= 0 && filtered[previewIndex] ? filtered[previewIndex].id : "";
        const item = pickRandom(filtered, current);
        const index = filtered.findIndex(function (it) { return it.id === item.id; });
        lastFocus = els.random;
        openPreview(index);
      });
      els.grid.addEventListener("click", function (event) {
        const card = event.target.closest(".card");
        if (!card) return;
        lastFocus = card;
        openPreview(Number(card.getAttribute("data-index")));
      });
      els.lightboxClose.addEventListener("click", closePreview);
      els.lightbox.addEventListener("click", function (event) {
        if (event.target && event.target.getAttribute("data-close") === "1") closePreview();
      });
      els.lightboxPrev.addEventListener("click", function () { openPreview(previewIndex - 1); });
      els.lightboxNext.addEventListener("click", function () { openPreview(previewIndex + 1); });
      els.copyName.addEventListener("click", function () {
        const item = filtered[previewIndex];
        if (!item || !navigator.clipboard) return;
        navigator.clipboard.writeText(item.file).then(function () {
          els.copyName.textContent = "已复制";
          setTimeout(function () { els.copyName.textContent = "复制文件名"; }, 1200);
        });
      });
      doc.addEventListener("keydown", onKey);
      window.addEventListener("popstate", function () {
        setFromUrl();
        renderFilters();
        apply();
        closePreview();
      });
    }

    function ready(data) {
      manifest = data;
      setFromUrl();
      if (els.search && state.query) els.search.value = state.query;
      renderHint();
      renderFilters();
      initTagPanel();
      apply();
      wire();
    }

    return fetch(manifestUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(ready)
      .catch(function (err) {
        showError("清单加载失败，请检查 gallery/manifest.json 是否可访问，然后刷新重试。（" + err.message + "）");
        if (els.random) {
          els.random.addEventListener("click", function () {
            showError("清单尚未加载成功，无法随机挑选。请刷新页面重试。");
          });
        }
        throw err;
      });
  }

  if (typeof document !== "undefined" && document.getElementById && document.getElementById("grid")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { mount(); });
    } else {
      mount();
    }
  }

  return {
    formatLabel: formatLabel,
    normalize: normalize,
    buildAliasIndex: buildAliasIndex,
    itemHaystack: itemHaystack,
    filterItems: filterItems,
    pickRandom: pickRandom,
    usedTags: usedTags,
    formatBytes: formatBytes,
    mount: mount,
  };
});
