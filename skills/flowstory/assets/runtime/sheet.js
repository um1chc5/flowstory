/* flowstory runtime — sheet.js: deep-dive side sheet with focus trap */
(function (global) {
  'use strict';

  var Md = global.FlowstoryMd;

  function createSheet(spec, onClose) {
    var sheetEl = document.getElementById('fs-sheet');
    var titleEl = document.getElementById('fs-sheet-title');
    var kickerEl = document.getElementById('fs-sheet-kicker');
    var bodyEl = document.getElementById('fs-sheet-body');
    var closeBtn = document.getElementById('fs-sheet-close');
    var backBtn = document.getElementById('fs-sheet-back');

    var history = [];
    var currentId = null;
    var lastTrigger = null;

    function getFocusable() {
      return sheetEl.querySelectorAll(
        'button:not([disabled]):not([hidden]), a[href], [tabindex]:not([tabindex="-1"])'
      );
    }

    function addSection(heading, contentNode) {
      var sec = document.createElement('section');
      sec.className = 'fs-sheet-sec';
      var h = document.createElement('h3');
      h.textContent = heading;
      sec.appendChild(h);
      sec.appendChild(contentNode);
      bodyEl.appendChild(sec);
    }

    function renderTextOrList(val) {
      if (Array.isArray(val)) {
        var ul = document.createElement('ul');
        ul.className = 'fs-sheet-list';
        for (var i = 0; i < val.length; i++) {
          var li = document.createElement('li');
          li.appendChild(Md.renderInline(val[i], navigateTo));
          ul.appendChild(li);
        }
        return ul;
      }
      var p = document.createElement('p');
      p.appendChild(Md.renderInline(val, navigateTo));
      return p;
    }

    function renderEntry(id) {
      var deepMap = (spec && spec.deep) || {};
      var entry = deepMap[id];
      if (!entry) return false;

      currentId = id;
      titleEl.textContent = entry.title || id;
      if (entry.kicker) {
        kickerEl.textContent = entry.kicker;
        kickerEl.hidden = false;
      } else {
        kickerEl.textContent = '';
        kickerEl.hidden = true;
      }

      backBtn.hidden = history.length === 0;
      Md.clearEl(bodyEl);

      // 5 fixed sections for node entries: role, how, code, weak, read
      if (entry.role) {
        addSection('Role', renderTextOrList(entry.role));
      }
      if (entry.how) {
        addSection('How it works', renderTextOrList(entry.how));
      }
      if (Array.isArray(entry.code) && entry.code.length > 0) {
        var codeUl = document.createElement('ul');
        codeUl.className = 'fs-code-list';
        for (var i = 0; i < entry.code.length; i++) {
          var item = entry.code[i];
          var li = document.createElement('li');
          var loc = document.createElement('code');
          loc.className = 'fs-code';
          loc.textContent = item.path + (item.lines ? ':' + item.lines : '');
          li.appendChild(loc);
          if (item.note) {
            var note = document.createElement('span');
            note.className = 'fs-code-note';
            note.textContent = ' — ';
            note.appendChild(Md.renderInline(item.note, navigateTo));
            li.appendChild(note);
          }
          codeUl.appendChild(li);
        }
        addSection('In the code', codeUl);
      }
      if (entry.weak && (!Array.isArray(entry.weak) || entry.weak.length > 0)) {
        addSection('Weak points', renderTextOrList(entry.weak));
      }
      if (Array.isArray(entry.read) && entry.read.length > 0) {
        var readUl = document.createElement('ul');
        readUl.className = 'fs-read-list';
        for (var j = 0; j < entry.read.length; j++) {
          var r = entry.read[j];
          if (!r || !r.url || !Md.isSafeHttpUrl(r.url)) continue;
          var rli = document.createElement('li');
          var a = document.createElement('a');
          a.href = r.url.trim();
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = r.title || r.url;
          rli.appendChild(a);
          readUl.appendChild(rli);
        }
        if (readUl.childNodes.length > 0) {
          addSection('Read more', readUl);
        }
      }

      return true;
    }

    function navigateTo(id) {
      if (!spec.deep || !spec.deep[id]) return;
      if (currentId && currentId !== id) {
        history.push(currentId);
      }
      renderEntry(id);
    }

    function open(id, triggerEl) {
      if (!spec.deep || !spec.deep[id]) return;
      lastTrigger = triggerEl || document.activeElement;
      history = [];
      if (!renderEntry(id)) return;
      sheetEl.hidden = false;
      sheetEl.setAttribute('aria-hidden', 'false');
      closeBtn.focus();
    }

    function close() {
      if (sheetEl.hidden) return;
      sheetEl.hidden = true;
      sheetEl.setAttribute('aria-hidden', 'true');
      currentId = null;
      history = [];
      if (lastTrigger && typeof lastTrigger.focus === 'function') {
        lastTrigger.focus();
      }
      if (typeof onClose === 'function') onClose();
    }

    closeBtn.addEventListener('click', close);
    backBtn.addEventListener('click', function () {
      if (history.length > 0) {
        var prev = history.pop();
        renderEntry(prev);
      }
    });

    sheetEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === 'Tab') {
        var focusables = getFocusable();
        if (focusables.length === 0) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    return {
      open: open,
      close: close,
      isOpen: function () { return !sheetEl.hidden; }
    };
  }

  global.FlowstorySheet = { createSheet: createSheet };
})(window);
