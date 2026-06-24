const API_BASE = import.meta.env.VITE_API_BASE || "";

export async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

export function createEventSource(path) {
  return new EventSource(`${API_BASE}${path}`, { withCredentials: true });
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function readImageFile(file) {
  return {
    name: file.name,
    type: file.type || "image/png",
    size: file.size,
    dataUrl: await readFileAsDataUrl(file)
  };
}

export async function readRemoteImageFile(asset) {
  const url = asset?.url || asset?.openUrl || "";
  if (!url) throw new Error("素材附件缺少访问地址。");
  const requestUrl = /^https?:\/\//i.test(url) ? url : `${API_BASE}${url}`;
  const response = await fetch(requestUrl, { credentials: "include" });
  if (!response.ok) throw new Error(`素材附件读取失败：${asset.name || url}`);
  const blob = await response.blob();
  return {
    name: asset.name || asset.fileName || "material-image.png",
    type: blob.type || asset.type || "image/png",
    size: blob.size || Number(asset.size || 0),
    dataUrl: await readFileAsDataUrl(blob)
  };
}

export async function extractDocxFile(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const data = await requestJson("/api/extract-docx", {
    method: "POST",
    body: JSON.stringify({ name: file.name, dataUrl })
  });
  if (!data.text) throw new Error("Word 文档里没有读取到正文文字。");
  return data.text;
}

export function formatBytes(value) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function findDeepValue(value, keys) {
  const queue = [value];
  const wanted = new Set(keys);
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    for (const [key, item] of Object.entries(current)) {
      if (wanted.has(key) && item) return item;
      if (item && typeof item === "object") queue.push(item);
    }
  }
  return "";
}
