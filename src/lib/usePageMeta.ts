import { useEffect } from 'react';

/**
 * Set document.title and meta description per page.
 * Also updates og:title and og:description for link sharing.
 */
export function usePageMeta(title: string, description?: string): void {
  useEffect(() => {
    document.title = title;

    if (description) {
      setMeta('description', description);
      setMetaProperty('og:title', title);
      setMetaProperty('og:description', description);
      setMetaProperty('og:image', `${window.location.origin}/og-image.png`);
      setMeta('twitter:image', `${window.location.origin}/og-image.png`);
    }
  }, [title, description]);
}

function setMeta(name: string, content: string): void {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setMetaProperty(property: string, content: string): void {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
