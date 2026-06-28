import { en } from './en.js';

export const lang = en;

export function t(key, params = {}) {
  const keys = key.split('.');
  let value = lang;

  for (const part of keys) {
    value = value?.[part];
  }

  if (typeof value !== 'string') return key;

  return value.replace(/\{(\w+)\}/g, (_, name) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}
