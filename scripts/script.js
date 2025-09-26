window.addEventListener("DOMContentLoaded", () => {
  // --- Elementlar
  const formBox = document.getElementById("registerForm"); // bu DIV!
  const emailInput = document.getElementById("inputEmail");
  const passwordInput = document.getElementById("inputPassword");
  const submitBtn = document.getElementById("submitBtn");

  // --- API manzillar
  const SEND_VALIDATION_URL = "http://mnews.jprq.site/api/v1/auth/send-validation/";
  const LOGIN_URL = "http://mnews.jprq.site/api/v1/auth/login/";

  // --- Loader overlay (JS orqali yaratamiz)
  const loader = document.createElement("div");
  loader.id = "globalLoader";
  loader.style.cssText = `
    position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.4); z-index: 9999;
  `;
  loader.innerHTML = `
    <div style="
      width: 64px; height: 64px; border: 6px solid #fff; border-top-color: transparent;
      border-radius: 50%; animation: spin 0.9s linear infinite;
    "></div>
    <style>
      @keyframes spin { to { transform: rotate(360deg);} }
    </style>
  `;
  document.body.appendChild(loader);
  const showLoader = () => (loader.style.display = "flex");
  const hideLoader = () => (loader.style.display = "none");

  // --- Yordamchi: validation
  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const isValidPassword = (p) => typeof p === "string" && p.length >= 8;

  // --- Tugmani faollashtirish
  function updateButtonState() {
    const ok = isValidEmail(emailInput.value.trim()) && isValidPassword(passwordInput.value);
    submitBtn.disabled = !ok;
  }
  emailInput.addEventListener("input", updateButtonState);
  passwordInput.addEventListener("input", updateButtonState);
  updateButtonState();

  // --- Xabar ko‘rsatish (oddiy)
  function flashMessage(text, type = "error") {
    // type: "error" | "info" | "success"
    let box = document.getElementById("errorMessage");
    if (!box) {
      box = document.createElement("div");
      box.id = "errorMessage";
      box.style.marginTop = "10px";
      formBox.appendChild(box);
    }
    box.textContent = text || "";
    box.style.color = type === "success" ? "#0a7a0a" : type === "info" ? "#004a9f" : "#b10000";
  }

  // --- Tokenlarni localStorage’ga saqlash (muddati bilan)
  function saveTokens({ access, refresh }) {
    const now = Date.now();
    // Siz aytganingiz bo‘yicha: access = 7 kun, refresh = 30 kun
    const accessExp = now + 7 * 24 * 60 * 60 * 1000;
    const refreshExp = now + 30 * 24 * 60 * 60 * 1000;

    localStorage.setItem("accessToken", access);
    localStorage.setItem("accessTokenExpiresAt", String(accessExp));
    localStorage.setItem("refreshToken", refresh);
    localStorage.setItem("refreshTokenExpiresAt", String(refreshExp));
  }

  // --- Login poller (har 5 sekundda urib ko‘rish)
  let pollTimer = null;
  let pollStopTime = null; // ixtiyoriy: maksimal kutish (masalan, 10 daqiqa)
  function startLoginPolling(payload) {
    const POLL_INTERVAL = 5000; // 5s
    const MAX_WAIT_MS = 10 * 60 * 1000; // 10 daqiqa
    pollStopTime = Date.now() + MAX_WAIT_MS;

    flashMessage("Tasdiqlash havolasi yuborildi. Emailni tasdiqlaganingizdan so‘ng avtomatik kirish amalga oshadi.", "info");

    pollTimer = setInterval(async () => {
      // Agar juda uzoq kutilsa, to‘xtatamiz
      if (Date.now() > pollStopTime) {
        clearInterval(pollTimer);
        hideLoader();
        flashMessage("Kirish vaqti tugadi. Iltimos, qayta urinib ko‘ring yoki emailni tasdiqlaganingizni tekshiring.", "error");
        return;
      }

      try {
        const res = await fetch(LOGIN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 200) {
          const data = await res.json();
          if (data?.tokens?.access && data?.tokens?.refresh) {
            saveTokens(data.tokens);
          }
          clearInterval(pollTimer);
          hideLoader();
          window.location.href = "second.html";
        } else {
          // 200 bo‘lmasa — jim kutamiz (email haligacha tasdiqlanmagan bo‘lishi mumkin)
          // console.log("Login hali tayyor emas:", res.status);
        }
      } catch (err) {
        // Tarmoq xatosi — keyingi urinishni kutamiz
        // console.error("Polling xatosi:", err);
      }
    }, POLL_INTERVAL);
  }

  // --- Submit bosilganda (div ichidagi tugma sabab click’dan foydalandik)
  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!isValidEmail(email)) {
      flashMessage("Email noto‘g‘ri kiritildi.");
      return;
    }
    if (!isValidPassword(password)) {
      flashMessage("Parol kamida 8 ta belgidan iborat bo‘lishi kerak.");
      return;
    }

    // 1) send-validation
    flashMessage("");
    submitBtn.disabled = true;

    try {
      const validationRes = await fetch(SEND_VALIDATION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Ko‘pincha faqat email kifoya. Siz "email+password yuboraman" dedingiz — ikkalasini ham yuborib qo‘yamiz.
        body: JSON.stringify({ email, password }),
      });

      if (validationRes.status === 201) {
        showLoader();
        // 2) Har 5 sekundda login qilib ko‘ramiz
        startLoginPolling({ email, password });
      } else if (validationRes.status === 200) {
        // Ba’zi backendlar 200 qaytarishi ham mumkin — baribir pollingni boshlaymiz
        showLoader();
        startLoginPolling({ email, password });
      } else {
        const txt = await validationRes.text().catch(() => "");
        flashMessage(`Validatsiya bajarilmadi (status ${validationRes.status}). ${txt || ""}`);
        submitBtn.disabled = false;
      }
    } catch (err) {
      flashMessage("Server bilan aloqa vaqtida xatolik yuz berdi.");
      submitBtn.disabled = false;
    }
  });
});
