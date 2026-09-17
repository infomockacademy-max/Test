/* ============================================================
   SPIN & WIN — configuration
   Edit the values below. Nothing else in this file needs to
   change for basic customization.
   ============================================================ */
var CONFIG = {
  // Where to send the player after they submit the claim form.
  // TODO: replace with your real destination URL.
  REDIRECT_URL: "https://example.com/thank-you",

  // Prize shown on the wheel and in the popup.
  PRIZE_AMOUNT: "\u20B1200",
  PRIZE_LABEL: "\u20B1200 Welcome Bonus",

  // Copy shown on the page. Change freely.
  HERO_HEADLINE_PLAIN: "Spin & Win",
  HERO_HEADLINE_ACCENT: "Instantly",
  HERO_SUB: "Every new player wins \u20B1200 \u2014 spin now to reveal your bonus.",
  SPIN_BUTTON_TEXT: "SPIN",
  CLAIM_BUTTON_TEXT: "Claim \u20B1200 Now",
  MODAL_KICKER: "Congratulations!",
  MODAL_MESSAGE: "You've won a \u20B1200 Welcome Bonus. Enter your details below to claim it instantly.",

  // Number of wedges drawn on the wheel (purely visual — every
  // wedge always carries the same prize, see note below).
  WHEEL_SEGMENTS: 8
};

/* ============================================================
   NOTE ON PRIZE LOGIC
   Every wedge on the wheel is labeled with the same prize
   (CONFIG.PRIZE_AMOUNT). The wheel still spins to a genuinely
   random landing position each time — that part is real
   randomness, so the animation looks natural and never lands
   in the exact same spot twice — but because every segment
   shows the same prize, the result is always the ₱200 bonus.
   This avoids implying odds/chances that don't actually exist.
   ============================================================ */

(function () {
  "use strict";

  var WEDGE_COLORS = ["#FF3B5C", "#FFD166", "#FF3B5C", "#FFD166", "#FF3B5C", "#FFD166", "#FF3B5C", "#FFD166"];
  var WEDGE_TEXT_COLORS = ["#FFFFFF", "#3A2500", "#FFFFFF", "#3A2500", "#FFFFFF", "#3A2500", "#FFFFFF", "#3A2500"];

  var wheelWrap = document.getElementById("wheelWrap");
  var canvas = document.getElementById("wheel");
  var ctx = canvas.getContext("2d");
  var spinBtn = document.getElementById("spinBtn");
  var spinHint = document.getElementById("spinHint");

  var modalOverlay = document.getElementById("modalOverlay");
  var modalKicker = document.getElementById("modalKicker");
  var modalPrize = document.getElementById("modalPrize");
  var modalMessage = document.getElementById("modalMessage");
  var modalClose = document.getElementById("modalClose");
  var claimForm = document.getElementById("claimForm");
  var nameInput = document.getElementById("nameInput");
  var mobileInput = document.getElementById("mobileInput");
  var nameError = document.getElementById("nameError");
  var mobileError = document.getElementById("mobileError");
  var claimBtn = document.getElementById("claimBtn");
  var confettiCanvas = document.getElementById("confettiCanvas");
  var confettiCtx = confettiCanvas.getContext("2d");

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- render config-driven copy ---------- */
  document.getElementById("heroHeadlinePlain").textContent = CONFIG.HERO_HEADLINE_PLAIN + " ";
  document.getElementById("heroHeadlineAccent").textContent = CONFIG.HERO_HEADLINE_ACCENT;
  document.getElementById("heroSub").textContent = CONFIG.HERO_SUB;
  spinBtn.textContent = CONFIG.SPIN_BUTTON_TEXT;
  modalKicker.textContent = CONFIG.MODAL_KICKER;
  modalPrize.textContent = CONFIG.PRIZE_AMOUNT;
  modalMessage.textContent = CONFIG.MODAL_MESSAGE;
  claimBtn.textContent = CONFIG.CLAIM_BUTTON_TEXT;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var dpr = Math.max(1, window.devicePixelRatio || 1);
  var displaySize = 400;
  var rotation = 0;
  var spinning = false;
  var hasSpun = false;

  /* ---------- canvas sizing ---------- */
  function resizeCanvas() {
    displaySize = wheelWrap.clientWidth || 400;
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWheel(rotation);
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, 120);
  });

  /* ---------- fit label text ---------- */
  function fitFontSize(text, maxWidth, baseSize) {
    var size = baseSize;
    ctx.font = "700 " + size + "px 'Poppins', sans-serif";
    while (ctx.measureText(text).width > maxWidth && size > 10) {
      size -= 1;
      ctx.font = "700 " + size + "px 'Poppins', sans-serif";
    }
    return size;
  }

  /* ---------- draw wheel ---------- */
  function drawWheel(rot) {
    var segments = CONFIG.WHEEL_SEGMENTS;
    var cx = displaySize / 2;
    var cy = displaySize / 2;
    var radius = displaySize / 2 - 4;
    var segAngle = (Math.PI * 2) / segments;

    ctx.clearRect(0, 0, displaySize, displaySize);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    for (var i = 0; i < segments; i++) {
      var start = i * segAngle;
      var end = start + segAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = WEDGE_COLORS[i % WEDGE_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(255,209,102,0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.rotate(start + segAngle / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = WEDGE_TEXT_COLORS[i % WEDGE_TEXT_COLORS.length];
      var maxW = radius * 0.6;
      var fontSize = fitFontSize(CONFIG.PRIZE_AMOUNT, maxW, 18);
      ctx.font = "700 " + fontSize + "px 'Poppins', sans-serif";
      ctx.fillText(CONFIG.PRIZE_AMOUNT, radius * 0.86, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  /* ---------- angle helpers ---------- */
  function normalizeAngle(a) {
    var twoPi = Math.PI * 2;
    return ((a % twoPi) + twoPi) % twoPi;
  }

  function easeOutQuint(t) {
    return 1 - Math.pow(1 - t, 5);
  }

  /* ---------- spin ---------- */
  function spin() {
    if (spinning || hasSpun) return;
    spinning = true;

    var segments = CONFIG.WHEEL_SEGMENTS;
    var segAngle = (Math.PI * 2) / segments;
    // Genuinely random landing index — purely for a natural-looking
    // animation. Every wedge shows the same prize, so this does not
    // affect the outcome.
    var targetIndex = Math.floor(Math.random() * segments);
    var jitter = (Math.random() - 0.5) * segAngle * 0.6;
    var desired = normalizeAngle(-Math.PI / 2 - (targetIndex + 0.5) * segAngle + jitter);
    var currentMod = normalizeAngle(rotation);
    var delta = normalizeAngle(desired - currentMod);
    var extraSpins = 6 + Math.floor(Math.random() * 3);
    var totalDelta = delta + extraSpins * Math.PI * 2;

    var startRotation = rotation;
    var endRotation = rotation + totalDelta;
    var duration = reduceMotion ? 400 : 5200;
    var startTime = null;

    function frame(ts) {
      if (startTime === null) startTime = ts;
      var elapsed = ts - startTime;
      var t = Math.min(1, elapsed / duration);
      var eased = easeOutQuint(t);
      rotation = startRotation + (endRotation - startRotation) * eased;
      drawWheel(rotation);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        rotation = endRotation;
        drawWheel(rotation);
        spinning = false;
        hasSpun = true;
        onSpinComplete();
      }
    }
    requestAnimationFrame(frame);
  }

  spinBtn.addEventListener("click", spin);

  /* ---------- result: always the configured prize ---------- */
  function onSpinComplete() {
    spinBtn.disabled = true;
    spinHint.textContent = "";
    modalOverlay.classList.add("open");
    nameInput.focus();
    if (!reduceMotion) launchConfetti();
  }

  /* ---------- claim form ----------
     TODO: connect a real backend before launch. As written, this
     only validates the fields in the browser and then redirects —
     it does NOT save or send the name/mobile number anywhere.
     Wire the fetch() call below to your CRM, database, or webhook
     (e.g. your player-registration API) to actually capture leads. */
  function isValidName(value) {
    return value.trim().length >= 2;
  }
  function isValidMobile(value) {
    var digits = value.replace(/[^0-9]/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }

  claimForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = nameInput.value;
    var mobile = mobileInput.value;
    var ok = true;

    if (!isValidName(name)) {
      nameError.textContent = "Please enter your name.";
      ok = false;
    } else {
      nameError.textContent = "";
    }

    if (!isValidMobile(mobile)) {
      mobileError.textContent = "Please enter a valid mobile number.";
      ok = false;
    } else {
      mobileError.textContent = "";
    }

    if (!ok) return;

    // ---- Example of where to send the lead to a real backend ----
    // fetch("https://your-api.example.com/leads", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ name: name, mobile: mobile })
    // });

    window.location.href = CONFIG.REDIRECT_URL;
  });

  function closeModal() {
    modalOverlay.classList.remove("open");
  }
  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", function (e) {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  /* ---------- confetti ---------- */
  function launchConfetti() {
    var rect = modalOverlay.querySelector(".modal-card").getBoundingClientRect();
    confettiCanvas.width = rect.width * dpr;
    confettiCanvas.height = rect.height * dpr;
    confettiCanvas.style.width = rect.width + "px";
    confettiCanvas.style.height = rect.height + "px";
    confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var colors = ["#FFD166", "#FF3B5C", "#FF2D9E", "#2FE6E6", "#FFFFFF"];
    var particles = [];
    var count = 70;
    for (var i = 0; i < count; i++) {
      particles.push({
        x: rect.width / 2,
        y: 20,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * -4 - 2,
        size: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        gravity: 0.15 + Math.random() * 0.08
      });
    }

    var start = null;
    var confettiDuration = 1700;
    function frame(ts) {
      if (start === null) start = ts;
      var elapsed = ts - start;
      confettiCtx.clearRect(0, 0, rect.width, rect.height);
      particles.forEach(function (p) {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;
        confettiCtx.save();
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.rotation);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        confettiCtx.restore();
      });
      if (elapsed < confettiDuration) {
        requestAnimationFrame(frame);
      } else {
        confettiCtx.clearRect(0, 0, rect.width, rect.height);
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- init ---------- */
  resizeCanvas();
})();
