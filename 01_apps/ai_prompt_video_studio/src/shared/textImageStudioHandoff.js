export const textImageStudioHandoffKey = "aiugc-text-image-studio-handoff-v1";
const mobileCreateIntentKey = "aiugc-mobile-create-intent";

export function buildTextImageStudioHandoff(node = {}) {
  const payload = node.payload || {};
  const image = payload.image || {};
  return {
    version: 1,
    nodeId: String(node.id || ""),
    runId: String(node.runId || node.run_id || ""),
    imageUrl: String(image.url || image.openUrl || ""),
    imageName: String(image.name || payload.title || "文生图图片.png"),
    imageType: String(image.type || image.mime || "image/png"),
    imageSize: Number(image.size || 0),
    title: String(payload.title || ""),
    prompt: String(payload.prompt || ""),
    negativePrompt: String(payload.negativePrompt || ""),
    model: String(payload.model || ""),
    size: String(payload.size || ""),
    createdAt: String(node.createdAt || node.created_at || payload.createdAt || ""),
    linkedAt: new Date().toISOString()
  };
}

export function saveTextImageStudioHandoff(node = {}) {
  const handoff = buildTextImageStudioHandoff(node);
  if (!handoff.nodeId) throw new Error("当前画布节点缺少编号。");
  if (!handoff.imageUrl) throw new Error("当前画布节点缺少图片地址。");
  localStorage.setItem(textImageStudioHandoffKey, JSON.stringify(handoff));
  localStorage.setItem(mobileCreateIntentKey, "images");
  return handoff;
}

export function consumeTextImageStudioHandoff() {
  try {
    const raw = localStorage.getItem(textImageStudioHandoffKey);
    localStorage.removeItem(textImageStudioHandoffKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.nodeId || !parsed?.imageUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}
