import sanitizeHtml from 'sanitize-html';

const defaultOptions: sanitizeHtml.IOptions = {
  allowedTags: [],       // Strip all HTML tags
  allowedAttributes: {}, // Strip all attributes
  disallowedTagsMode: 'discard',
  allowedSchemes: [],
};

/**
 * Strip all HTML from user-provided text content to prevent XSS.
 * Also trims whitespace and limits length.
 */
export function sanitizeText(input: string, maxLength = 10000): string {
  if (typeof input !== 'string') return '';
  const stripped = sanitizeHtml(input, defaultOptions).trim();
  return stripped.slice(0, maxLength);
}

/**
 * Sanitize listing description — allows only basic safe tags if needed,
 * but defaults to full strip.
 */
export function sanitizeDescription(input: string, maxLength = 50000): string {
  if (typeof input !== 'string') return '';
  const stripped = sanitizeHtml(input, {
    allowedTags: ['p', 'br', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li'],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
    allowedSchemes: [],
  }).trim();
  return stripped.slice(0, maxLength);
}