/* =============================================================
   main.js — realestateandloans.com
   Mobile navigation + contact form handling.
   Vanilla JS, no dependencies. Each block is guarded so the
   single shared file is safe to load on every page.
   ============================================================= */
(function () {
  'use strict';

  /* ---- Mobile navigation ------------------------------------ */
  var toggle = document.querySelector('.nav__toggle');
  var menu = document.getElementById('nav-menu');

  if (toggle && menu) {
    var setOpen = function (open) {
      menu.setAttribute('data-open', open ? 'true' : 'false');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Close when a menu link is tapped.
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    // Close on Escape.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });

    // Close when clicking anywhere outside the header.
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.site-header')) setOpen(false);
    });
  }

  /* ---- Contact form ----------------------------------------- */
  var form = document.getElementById('contact-form');
  if (form) {
    var status = document.getElementById('form-status');
    // Apps Script web-app URL is set on the form's data-endpoint
    // attribute after the script is deployed (see /apps-script).
    var endpoint = form.getAttribute('data-endpoint') || '';

    var showStatus = function (msg, kind) {
      if (!status) return;
      status.textContent = msg;
      status.className = 'form-status form-status--' + kind;
      status.hidden = false;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Honeypot: bots fill hidden fields, humans never see them.
      var hp = form.querySelector('[name="company"]');
      if (hp && hp.value.trim() !== '') return;

      // Native client-side validation.
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (!endpoint) {
        showStatus('Something went wrong. Please call 949.448.0961 directly.', 'error');
        return;
      }

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      showStatus('Sending…', 'success');

      fetch(endpoint, { method: 'POST', body: new FormData(form) })
        .then(function (res) {
          if (!res.ok) throw new Error('Bad response');
          form.reset();
          showStatus('Thanks, Gregg will be in touch shortly.', 'success');
        })
        .catch(function () {
          showStatus('Something went wrong. Please call 949.448.0961 directly.', 'error');
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }
})();
