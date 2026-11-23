/* flowstory runtime — md.js: safe inline-markup renderer (no innerHTML) */
(function (global) {
  'use strict';

  var TOKEN_RE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|\[\[[A-Za-z0-9_-]+\]\])/g;

  function isSafeHttpUrl(url) {
    return /^https?:\/\//i.test(String(url || '').trim());
  }

  function renderInline(text, onRefClick) {
    var frag = document.createDocumentFragment();
    if (text === null || text === undefined) return frag;
    var str = String(text);
    var last = 0;
    var match;
    TOKEN_RE.lastIndex = 0;

    while ((match = TOKEN_RE.exec(str)) !== null) {
      if (match.index > last) {
        frag.appendChild(document.createTextNode(str.slice(last, match.index)));
      }
      var tok = match[0];
      if (tok.charAt(0) === '`') {
        var code = document.createElement('code');
        code.className = 'fs-code';
        code.textContent = tok.slice(1, -1);
        frag.appendChild(code);
      } else if (tok.slice(0, 2) === '**') {
        var strong = document.createElement('strong');
        strong.textContent = tok.slice(2, -2);
        frag.appendChild(strong);
      } else if (tok.charAt(0) === '*') {
        var em = document.createElement('em');
        em.textContent = tok.slice(1, -1);
        frag.appendChild(em);
      } else if (tok.slice(0, 2) === '[[') {
        var refId = tok.slice(2, -2);
        if (typeof onRefClick === 'function') {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'fs-ref-link';
          btn.textContent = refId;
          btn.setAttribute('data-ref', refId);
          btn.addEventListener('click', (function (id) {
            return function () { onRefClick(id); };
          })(refId));
          frag.appendChild(btn);
        } else {
          var span = document.createElement('span');
          span.className = 'fs-ref-tag';
          span.textContent = refId;
          frag.appendChild(span);
        }
      } else {
        var linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
        if (linkMatch && isSafeHttpUrl(linkMatch[2])) {
          var a = document.createElement('a');
          a.href = linkMatch[2].trim();
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = linkMatch[1];
          frag.appendChild(a);
        } else {
          frag.appendChild(document.createTextNode(tok));
        }
      }
      last = TOKEN_RE.lastIndex;
    }

    if (last < str.length) {
      frag.appendChild(document.createTextNode(str.slice(last)));
    }
    return frag;
  }

  function clearEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  global.FlowstoryMd = {
    renderInline: renderInline,
    isSafeHttpUrl: isSafeHttpUrl,
    clearEl: clearEl
  };
})(window);
