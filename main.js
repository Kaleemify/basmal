// Optimized main.js - extracted from inline script
// Goals: reduce main-thread work, improve mobile metrics (LCP, FID, CLS, TBT)

(function () {
  'use strict';

  // Utility helpers
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  // DOM elements cached
  var mobileMenuButton = $('#mobileMenuButton');
  var mobileMenu = $('#mobileMenu');
  var mobileBackdrop = $('#mobileBackdrop');
  var navbar = $('#navbar');
  var statsSection = $('.stats-grid');
  var professionalContactForm = $('#professionalContactForm');

  // Passive event options when appropriate
  var passiveIfSupported = (function () {
    var supports = false;
    try {
      var opts = Object.defineProperty({}, 'passive', { get: function () { supports = true; } });
      window.addEventListener('testPassive', null, opts);
      window.removeEventListener('testPassive', null, opts);
    } catch (e) { }
    return supports ? { passive: true } : false;
  })();

  // Debounce helper
  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  // Throttle helper for scroll (runs at most every `limit` ms)
  function throttle(fn, limit) {
    var waiting = false;
    return function () {
      if (!waiting) {
        fn.apply(null, arguments);
        waiting = true;
        setTimeout(function () { waiting = false; }, limit);
      }
    };
  }

  // Toggle mobile menu
  function toggleMobileMenu() {
    if (!mobileMenu || !mobileBackdrop) return;
    var active = mobileMenu.classList.toggle('active');
    mobileBackdrop.classList.toggle('active', active);
    document.body.style.overflow = active ? 'hidden' : '';
  }

  function closeMobileMenu() {
    if (!mobileMenu || !mobileBackdrop) return;
    mobileMenu.classList.remove('active');
    mobileBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Use a lightweight, debounced scroll handler to toggle navbar class
  function handleNavbarScroll() {
    if (!navbar) return;
    if (window.scrollY > 50) navbar.classList.add('scrolled'); else navbar.classList.remove('scrolled');
  }

  // Smooth scroll only if browser supports it natively (avoid JS fallback on mobile)
  function initAnchorSmoothScroll() {
    // Only for same-page hash links
    $$("a[href^='#']").forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var href = anchor.getAttribute('href');
        if (!href || href === '#') return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        var headerOffset = 80;
        var elementPosition = target.offsetTop;
        var offsetPosition = elementPosition - headerOffset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }, false);
    });
  }

  // IntersectionObserver for reveal animations (unobserve after reveal)
  function initRevealOnScroll() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: simply add visible class
      $$( '.fade-in, .slide-in-left, .slide-in-right' ).forEach(function (el) { el.classList.add('visible'); });
      return;
    }

    var options = { threshold: 0.12, rootMargin: '50px 0px -50px 0px' };
    var obs = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, options);

    $$( '.fade-in, .slide-in-left, .slide-in-right' ).forEach(function (el) { obs.observe(el); });
  }

  // Counter animation optimized: runs once, uses requestAnimationFrame
  function animateCountersOnce() {
    var counters = $$( '.stat-number' );
    if (!counters.length) return;

    counters.forEach(function (c) { c.__started = false; });

    function animate() {
      var running = false;
      counters.forEach(function (c) {
        var target = parseInt(c.getAttribute('data-count')) || 0;
        var current = parseInt(c.__value || c.textContent.replace(/[^0-9]/g, '')) || 0;
        if (!c.__started) { c.__started = true; c.__value = current; }
        if (current < target) {
          running = true;
          var inc = Math.max(1, Math.round((target - current) / 12));
          c.__value = current + inc;
          c.textContent = c.__value;
        } else {
          // restore original suffixes if present in markup
          var txt = c.closest('.stat-card').querySelector('.stat-number').textContent;
          if (txt.indexOf('/') > -1) c.textContent = txt;
          else if (txt.indexOf('+') > -1) c.textContent = target + '+';
          else if (txt.indexOf('%') > -1) c.textContent = target + '%';
          else c.textContent = target;
        }
      });

      if (running) requestAnimationFrame(animate);
    }

    // Trigger when section visible using IntersectionObserver to avoid jank before LCP
    if ('IntersectionObserver' in window && statsSection) {
      var sObs = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            requestAnimationFrame(animate);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });
      sObs.observe(statsSection);
    } else {
      // fallback
      requestAnimationFrame(animate);
    }
  }

  // Lightweight toast message (non-blocking)
  function showMessage(msg, type) {
    try {
      var m = document.createElement('div');
      m.className = '__toast-msg';
      m.textContent = msg;
      m.style.cssText = 'position:fixed;top:80px;right:16px;padding:12px 16px;border-radius:10px;color:#fff;z-index:10000;transition:transform .3s ease,opacity .3s ease;transform:translateX(120%);opacity:0;font-size:14px;box-shadow:0 8px 20px rgba(0,0,0,.18);';
      m.style.background = type === 'success' ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#EF4444,#DC2626)';
      document.body.appendChild(m);
      requestAnimationFrame(function () { m.style.transform = 'translateX(0)'; m.style.opacity = '1'; });
      setTimeout(function () { m.style.transform = 'translateX(120%)'; m.style.opacity = '0'; setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 300); }, 4800);
    } catch (e) { /* ignore */ }
  }


  // Accessibility: close mobile menu on escape
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMobileMenu();
    }, false);
  }

  // Close mobile menu on resize (debounced)
  function initResizeHandler() {
    window.addEventListener('resize', debounce(function () {
      if (window.innerWidth > 1024) closeMobileMenu();
    }, 120), false);
  }

  // Focus styling for inputs (event delegation)
  function initFormFocusStyling() {
    document.addEventListener('focusin', function (e) {
      var el = e.target;
      if (el.matches && el.matches('.form-input-new, .form-select-new, .form-textarea-new')) {
        if (el.parentElement) el.parentElement.classList.add('focused');
      }
    }, false);

    document.addEventListener('focusout', function (e) {
      var el = e.target;
      if (el.matches && el.matches('.form-input-new, .form-select-new, .form-textarea-new')) {
        if (el.parentElement) el.parentElement.classList.remove('focused');
      }
    }, false);
  }

  // Initialize everything (minimal synchronous work)
  function init() {
    // Attach lightweight event handlers
    if (mobileMenuButton) mobileMenuButton.addEventListener('click', toggleMobileMenu, false);
    if (mobileBackdrop) mobileBackdrop.addEventListener('click', closeMobileMenu, false);

    // Use a throttled scroll listener to limit work
    window.addEventListener('scroll', throttle(handleNavbarScroll, 150), passiveIfSupported);

    // Initialize behaviors that can wait until DOM is interactive
    initAnchorSmoothScroll();
    initRevealOnScroll();
    animateCountersOnce();
    initContactForm();
    initKeyboardShortcuts();
    initResizeHandler();
    initFormFocusStyling();

    // run initial state
    handleNavbarScroll();
  }

  // Run init after DOM is parsed
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, false); else init();
})();

document.getElementById("professionalContactForm").addEventListener("submit", function(e) {
    e.preventDefault(); // default redirect block
    const form = e.target;

    fetch(form.action, {
        method: form.method,
        body: new FormData(form)
    }).then(response => {
        if (response.ok) {
            window.location.href = "/Thanks.html"; // custom redirect
        } else {
            alert("Something went wrong, please try again.");
        }
    }).catch(error => {
        alert("Error: " + error.message);
    });
});