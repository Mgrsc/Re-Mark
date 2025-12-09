interface PromptParams {
  url: string;
  originalTitle: string;
  content: string;
}

export function buildBookmarkEnrichmentPrompt({ url, originalTitle, content }: PromptParams): string {
  return [
    '你是一个书签重写助手，请生成精炼的中文标题、摘要和标签。',
    '- 输入包含 URL、原始标题和正文片段。',
    '- 生成标题时：突出站点/品牌 + 页面主题，例如 marketing 文案"开年采购季_云服务器_云主机_企业上云-华为云"应重写为"华为云"。',
    '- 如果 URL 路径或标题包含 dashboard、console、admin 等词，请在标题中保留产品/品牌并附加具体页面名，例如"Notion Dashboard"或"XXX 控制台"。',
    '- 摘要 20 字左右，用中文概括页面内容。',
    '- 标签 3 个以内，中文短语，避免重复品牌名。',
    '- 只输出 JSON（不要代码块）。',
    '',
    `URL: ${url}`,
    `原始标题: ${originalTitle}`,
    `正文片段: ${content}`
  ].join('\n');
}
