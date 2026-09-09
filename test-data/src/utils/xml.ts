export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function escapeCdata(text: string): string {
  // If text contains ']]>', split it so the CDATA section is safely terminated and reopened
  return text.replace(/\]\]>/g, ']]]]><![CDATA[>');
}

export function extractXmlValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = regex.exec(xml);
  if (!match) {
    return null;
  }

  let val = match[1].trim();
  if (val.startsWith('<![CDATA[') && val.endsWith(']]>')) {
    val = val.slice(9, -3).trim();
  }
  return val;
}
