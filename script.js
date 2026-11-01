(() => {
  "use strict";

  const prices = {
    documents: {
      order_cancel: 3000,
      koap_kas: 5000,
      claim: 7000,
      objection: 7000,
      appeal: 10000
    },
    categories: {
      debt_contract: 1,
      consumer: 1,
      auto_fssp: 1.1,
      family_inherit: 1.15,
      realty_land: 1.25,
      arbitration: 1.4
    },
    formats: {
      doc_only: 0,
      doc_filing: 2500,
      turnkey_irkutsk: 15000
    },
    urgency: {
      standard: 1,
      urgent: 1.3
    }
  };

  const labels = {
    documents: {
      order_cancel: "Отмена приказа или ходатайство",
      koap_kas: "Жалоба по КоАП или иск по КАС",
      claim: "Исковое заявление",
      objection: "Возражение или отзыв",
      appeal: "Апелляционная или кассационная жалоба"
    },
    categories: {
      debt_contract: "Долги и договоры",
      consumer: "Защита прав потребителей",
      auto_fssp: "ДТП, ГИБДД и приставы",
      family_inherit: "Семейные и наследственные споры",
      realty_land: "Недвижимость, жилье и земля",
      arbitration: "Арбитражные споры"
    },
    formats: {
      doc_only: "Документ и инструкция",
      doc_filing: "Документ и дистанционная подача",
      turnkey_irkutsk: "Под ключ с участием в Иркутске"
    },
    urgency: {
      standard: "Штатно",
      urgent: "Срочно"
    }
  };

  const deadlines = {
    order: { days: 10, title: "Судебный приказ", docType: "order_cancel", category: "debt_contract", statute: "ст. 128 ГПК РФ" },
    koap: { days: 10, title: "Постановление по КоАП РФ", docType: "koap_kas", category: "auto_fssp", statute: "ст. 30.3 КоАП РФ" },
    bailiff: { days: 10, title: "Действие или постановление пристава", docType: "koap_kas", category: "auto_fssp", statute: "ст. 219 КАС РФ" },
    appeal: { months: 1, title: "Решение суда первой инстанции", docType: "appeal", category: "debt_contract", statute: "ст. 321 ГПК РФ / ст. 259 АПК РФ" },
    private: { days: 15, title: "Определение суда", docType: "appeal", category: "debt_contract", statute: "ст. 332 ГПК РФ" }
  };

  const checklistBase = {
    order_cancel: ["Судебный приказ целиком, включая последнюю страницу", "Конверт, уведомление или экран отслеживания вручения", "Документы о взыскании и списании, если они есть"],
    koap_kas: ["Постановление или оспариваемый ответ целиком", "Конверт, отметка или сообщение о дате получения", "Фото, видео, чеки и переписка по событию"],
    claim: ["Проект иска или описание требований", "Договоры, расписки, акты и платежные документы", "Переписка и документы, подтверждающие обстоятельства"],
    objection: ["Иск и все приложения к нему", "Договоры, акты, платежи и переписка", "Определение суда и дата ближайшего заседания"],
    appeal: ["Полный текст решения или определения суда", "Протокол заседания и ранее поданные документы", "Конверт или уведомление о дате получения судебного акта"]
  };
  const categoryChecklist = {
    debt_contract: ["Расчет долга и платежные документы"],
    consumer: ["Претензия, ответ и подтверждение отправки"],
    auto_fssp: ["Материалы ДТП, постановление или документы ФССП"],
    family_inherit: ["Документы о родстве, браке или наследстве"],
    realty_land: ["Выписка ЕГРН, адрес объекта и правоустанавливающие документы"],
    arbitration: ["Выписка ЕГРЮЛ или ЕГРИП и документы о претензионном порядке"]
  };
  const anatomy = {
    claim: {
      label: "ИСКОВОЕ ЗАЯВЛЕНИЕ",
      points: [
        ["Подсудность", "Проверяем, какой суд должен рассматривать спор, и указываем необходимые сведения о сторонах."],
        ["Фактура и доказательства", "Излагаем события в понятной последовательности и связываем важные факты с приложенными доказательствами."],
        ["Правовые основания", "Подбираем применимые нормы и относящиеся к спору выводы судов, не подменяя ими факты."],
        ["Расчет требований", "Показываем состав суммы и проверяем расчет, цену иска и вопрос о госпошлине."],
        ["Просительная часть", "Формулируем конкретный результат, который просим суд установить или взыскать."]
      ]
    },
    objection: {
      label: "ВОЗРАЖЕНИЕ НА ИСК",
      points: [
        ["Подсудность и стороны", "Сверяем сведения о суде и участниках дела с иском и судебными извещениями."],
        ["Фактура и доказательства", "Отвечаем на существенные факты истца и показываем, какими документами подтверждается позиция."],
        ["Правовые основания", "Сопоставляем доводы иска с применимыми нормами и обстоятельствами конкретного спора."],
        ["Расчет требований", "Проверяем каждый элемент заявленной суммы и отдельно указываем спорные расчеты."],
        ["Просительная часть", "Указываем, какие требования просим отклонить или оценить иначе, и заявляем необходимые ходатайства."]
      ]
    },
    appeal: {
      label: "АПЕЛЛЯЦИОННАЯ ЖАЛОБА",
      points: [
        ["Порядок подачи", "Уточняем срок, суд первой инстанции и правила направления жалобы участникам дела."],
        ["Обстоятельства и доказательства", "Выделяем факты, которые суд установил или оценил спорным образом, и проверяем допустимость новых материалов."],
        ["Основания пересмотра", "Связываем конкретные нарушения с выводами решения и применимыми нормами."],
        ["Расчет и последствия", "Проверяем, как спорные выводы повлияли на взыскание и иные части решения."],
        ["Просительная часть", "Формулируем допустимый вариант пересмотра решения и необходимые сопутствующие просьбы."]
      ]
    }
  };

  const storageKey = "mariaCalculator";
  const defaults = { docType: "order_cancel", disputeCategory: "debt_contract", workFormat: "doc_only", urgency: "standard" };
  let state = { ...defaults };
  let latestDeadline = "";
  let latestDeadlineType = "order";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const formatMoney = (value) => new Intl.NumberFormat("ru-RU").format(value);
  const roundHundred = (value) => Math.round(value / 100) * 100;

  function readSavedState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!saved || typeof saved !== "object") return;
      for (const key of Object.keys(defaults)) {
        if (Object.prototype.hasOwnProperty.call(saved, key) && prices[key === "docType" ? "documents" : key === "disputeCategory" ? "categories" : key === "workFormat" ? "formats" : "urgency"][saved[key]] !== undefined) {
          state[key] = saved[key];
        }
      }
    } catch (error) {
      console.warn("Не удалось прочитать параметры калькулятора из браузерного хранилища.", error);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn("Не удалось сохранить параметры калькулятора в браузерном хранилище.", error);
    }
  }

  function setCalcValue(key, value) {
    const table = key === "docType" ? prices.documents : key === "disputeCategory" ? prices.categories : key === "workFormat" ? prices.formats : prices.urgency;
    if (!Object.prototype.hasOwnProperty.call(table, value)) return;
    state[key] = value;
    const radio = $(`input[name="${key}"][value="${value}"]`);
    if (radio) radio.checked = true;
    if (key === "disputeCategory") $("#dispute-category").value = value;
    saveState();
    renderCalculator();
  }

  function currentPrice() {
    const documentCost = roundHundred(prices.documents[state.docType] * prices.categories[state.disputeCategory]);
    const subtotal = documentCost + prices.formats[state.workFormat];
    return { documentCost, subtotal, total: roundHundred(subtotal * prices.urgency[state.urgency]) };
  }

  function renderCalculator() {
    const price = currentPrice();
    $("#total-price").textContent = formatMoney(price.total);
    $("#price-breakdown").innerHTML = [
      `<div class="breakdown-row"><span>${labels.documents[state.docType]}</span><span>${formatMoney(prices.documents[state.docType])} ₽</span></div>`,
      `<div class="breakdown-row"><span>${labels.categories[state.disputeCategory]} · коэффициент</span><span>× ${prices.categories[state.disputeCategory].toLocaleString("ru-RU")}</span></div>`,
      `<div class="breakdown-row"><span>${labels.formats[state.workFormat]}</span><span>+ ${formatMoney(prices.formats[state.workFormat])} ₽</span></div>`,
      `<div class="breakdown-row"><span>${labels.urgency[state.urgency]}</span><span>× ${prices.urgency[state.urgency].toLocaleString("ru-RU")}</span></div>`
    ].join("");

    const priority = $("#priority-status");
    priority.textContent = state.urgency === "urgent" ? "Горящий срок" : "Штатный режим";
    priority.parentElement.classList.toggle("is-urgent", state.urgency === "urgent");

    const checklist = [...checklistBase[state.docType], ...(categoryChecklist[state.disputeCategory] || [])];
    $("#photo-checklist").innerHTML = checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    $("#request-price").textContent = `РАСЧЕТ: ${formatMoney(price.total)} ₽`;
    const form = $("#request-form");
    for (const key of Object.keys(defaults)) {
      const hidden = $(`input[name="${key}"]`, form);
      if (hidden) hidden.value = state[key];
    }
    $('input[name="totalPrice"]', form).value = String(price.total);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function getIrkutskDate() {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Irkutsk", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return new Date(Date.UTC(Number(part.year), Number(part.month) - 1, Number(part.day)));
  }

  function addCalendarMonth(date) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const targetFirst = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth(), Math.min(day, lastDay)));
  }

  function renderDeadline() {
    const result = $("#deadline-result");
    const dateValue = $("#received-date").value;
    const type = deadlines[$("#deadline-type").value];
    latestDeadlineType = $("#deadline-type").value;
    result.className = "deadline-result";
    if (!dateValue) {
      latestDeadline = "";
      result.innerHTML = '<span class="result-mark">ДАТА НЕ ВЫБРАНА</span><h3>Проверьте срок подачи</h3><p>Выберите документ и дату вручения, чтобы увидеть расчет.</p>';
      return;
    }
    const [year, month, day] = dateValue.split("-").map(Number);
    const received = new Date(Date.UTC(year, month - 1, day));
    let due = type.months ? addCalendarMonth(received) : new Date(received.getTime() + type.days * 86400000);
    const dayOfWeek = due.getUTCDay();
    let weekendNote = "";
    if (dayOfWeek === 6) {
      due = new Date(due.getTime() + 2 * 86400000);
      weekendNote = " Выходной день перенесен на понедельник по правилу ст. 108 ГПК РФ.";
    } else if (dayOfWeek === 0) {
      due = new Date(due.getTime() + 86400000);
      weekendNote = " Выходной день перенесен на понедельник по правилу ст. 108 ГПК РФ.";
    }
    const today = getIrkutskDate();
    const remaining = Math.round((due.getTime() - today.getTime()) / 86400000);
    latestDeadline = `${due.getUTCFullYear()}-${String(due.getUTCMonth() + 1).padStart(2, "0")}-${String(due.getUTCDate()).padStart(2, "0")}`;
    const dueText = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(due);
    let marker;
    let title;
    let note = `${type.statute}. Дата получения не включена в расчетный период.${weekendNote}`;
    if (remaining < 0) {
      result.classList.add("status-expired");
      marker = "СРОК ИСТЕК";
      title = `Крайняя дата: ${dueText}`;
      note = `Проверьте возможность ходатайства о восстановлении срока по ст. 112 ГПК РФ. Это зависит от причин пропуска и применимого порядка.${weekendNote}`;
    } else if (remaining <= 3) {
      result.classList.add("status-urgent");
      marker = remaining === 0 ? "ГОРЯЩИЙ СРОК · ПОСЛЕДНИЙ ДЕНЬ" : "ГОРЯЩИЙ СРОК";
      title = remaining === 0 ? `Подать нужно сегодня, ${dueText}` : `Осталось ${remaining} ${remaining === 1 ? "день" : remaining === 2 ? "дня" : "дня"}`;
    } else {
      result.classList.add("status-ok");
      marker = "ШТАТНЫЙ РЕЖИМ";
      title = `Крайняя дата: ${dueText}`;
      note = `Осталось ${remaining} дн. ${note}`;
    }
    result.innerHTML = `<span class="result-mark">${escapeHtml(marker)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(note)}</p>`;
  }

  function currentChecklistText() {
    return [...checklistBase[state.docType], ...(categoryChecklist[state.disputeCategory] || [])].map((item) => `• ${item}`).join("\n");
  }

  function composeMessage() {
    const dateLabel = latestDeadline ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${latestDeadline}T00:00:00Z`)) : "не указан";
    const city = document.querySelector('[data-geo="irkutsk"]').getAttribute("aria-pressed") === "true" ? "Иркутск" : "дистанционно, вся Россия";
    return [
      "Здравствуйте, Мария. Прошу посмотреть ситуацию.",
      `Документ: ${labels.documents[state.docType]}`,
      `Категория: ${labels.categories[state.disputeCategory]}`,
      `Формат: ${labels.formats[state.workFormat]}`,
      `Срочность: ${labels.urgency[state.urgency]}`,
      `Крайний срок подачи (ориентир): ${dateLabel}`,
      `Город / формат связи: ${city}`,
      `Предварительный расчет: ${formatMoney(currentPrice().total)} ₽`,
      "Что подготовить:\n" + currentChecklistText()
    ].join("\n");
  }

  function updateConsentButtons() {
    const permitted = $("#consent").checked;
    for (const button of [$("#submit-button"), $("#telegram-button"), $("#whatsapp-button")]) {
      button.disabled = !permitted;
      button.setAttribute("aria-disabled", String(!permitted));
    }
  }

  function openMessenger(kind) {
    if (!$("#consent").checked) return;
    const text = encodeURIComponent(composeMessage());
    const url = kind === "telegram"
      ? `https://t.me/share/url?url=&text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function applyGeo(mode) {
    $$("[data-geo]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.geo === mode)));
    $$("[data-geo-content]").forEach((element) => { element.hidden = element.dataset.geoContent !== mode; });
    const localFormat = $('[data-local-format]');
    localFormat.classList.toggle("geo-muted", mode !== "irkutsk");
    $("#format-hint").textContent = mode === "irkutsk"
      ? "Очный формат доступен для Иркутска и Иркутского района."
      : "Для других регионов доступны документ и дистанционная подача.";
  }

  function initPhoneMask() {
    const input = $("#client-phone");
    input.addEventListener("input", () => {
      let digits = input.value.replace(/\D/g, "");
      if (digits.length === 0) {
        input.value = "";
        return;
      }
      if (digits.startsWith("7") || digits.startsWith("8")) {
        if (digits.length === 1) {
          input.value = "+7 (";
          return;
        }
        digits = digits.slice(1);
      }
      digits = digits.slice(0, 10);
      let formatted = "+7 (" + digits.slice(0, 3);
      if (digits.length > 3) formatted += ") " + digits.slice(3, 6);
      if (digits.length > 6) formatted += "-" + digits.slice(6, 8);
      if (digits.length > 8) formatted += "-" + digits.slice(8, 10);
      input.value = formatted;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && ["+7 (", "+7", "+7 "].includes(input.value)) {
        event.preventDefault();
        input.value = "";
      }
    });
  }

  function showFormError(message) {
    const error = $("#form-error");
    error.textContent = message;
    error.hidden = false;
    $("#form-success").hidden = true;
  }

  function showFormSuccess(message) {
    const success = $("#form-success");
    success.textContent = message;
    success.hidden = false;
    $("#form-error").hidden = true;
  }

  function validateForm() {
    const form = $("#request-form");
    if (!form.reportValidity()) return false;
    const digits = $("#client-phone").value.replace(/\D/g, "");
    if (digits.length !== 11 || !digits.startsWith("7")) {
      showFormError("Введите телефон полностью: 10 цифр после кода страны +7.");
      $("#client-phone").focus();
      return false;
    }
    if (!$("#consent").checked) {
      showFormError("Для отправки заявки необходимо согласие на обработку персональных данных.");
      return false;
    }
    return true;
  }

  async function submitForm(event) {
    event.preventDefault();
    if (!validateForm()) return;
    const form = $("#request-form");
    const button = $("#submit-button");
    const submitLabel = $(".submit-label", button);
    const loadingLabel = $(".submit-loading", button);
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.consent = $("#consent").checked;
    payload.deadline = latestDeadline;
    payload.totalPrice = currentPrice().total;
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    button.classList.add("is-loading");
    submitLabel.hidden = true;
    loadingLabel.hidden = false;
    $("#form-error").hidden = true;
    $("#form-success").hidden = true;

    const isGithubPages = window.location.hostname.endsWith(".github.io");
    try {
      const response = await fetch("send.php", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        if (isGithubPages && (response.status === 404 || response.status === 405)) {
          showFormSuccess("Демонстрационный режим GitHub Pages: заявка не отправлена. На хостинге с PHP форма передаст обращение Марии.");
          form.reset();
          return;
        }
        let detail = `Сервер вернул ошибку ${response.status}. Попробуйте позже или подготовьте сообщение в мессенджере.`;
        try {
          const errorBody = await response.json();
          if (errorBody && typeof errorBody.error === "string") detail = errorBody.error;
        } catch (parseError) {
          console.warn("Ответ сервера не содержит JSON.", parseError);
        }
        throw new Error(detail);
      }
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error("Сервер ответил данными, которые не удалось разобрать как JSON.", parseError);
        throw new Error("Сервер вернул некорректный ответ. Попробуйте позже или подготовьте сообщение в мессенджере.");
      }
      if (!result || result.ok !== true) throw new Error(typeof result?.error === "string" ? result.error : "Сервер не подтвердил получение заявки.");
      showFormSuccess("Заявка принята. Мария свяжется с вами по указанному телефону.");
      form.reset();
      updateConsentButtons();
    } catch (error) {
      const isNetworkError = error instanceof TypeError ||
        error?.name === "TypeError" ||
        /failed to fetch|networkerror|load failed/i.test(String(error?.message || ""));
      if (isGithubPages && isNetworkError) {
        showFormSuccess("Демонстрационный режим GitHub Pages: заявка не отправлена. На хостинге с PHP форма передаст обращение Марии.");
      } else if (isNetworkError) {
        showFormError("Серверный обработчик send.php недоступен (страница открыта локально без PHP-сервера). На хостинге с PHP заявка будет записана в журнал, а сейчас вы можете протестировать отправку готовой карточки в Telegram или WhatsApp.");
      } else {
        showFormError(error instanceof Error ? error.message : "Не удалось отправить заявку. Проверьте соединение и попробуйте еще раз.");
      }
    } finally {
      button.classList.remove("is-loading");
      submitLabel.hidden = false;
      loadingLabel.hidden = true;
      updateConsentButtons();
    }
  }

  function setClock() {
    const now = new Date();
    const clockText = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Irkutsk", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
    for (const element of [$("#header-clock"), $("#form-clock")]) {
      element.dateTime = now.toISOString();
      element.textContent = clockText;
    }
  }

  function initMenu() {
    const header = $(".site-header");
    const toggle = $(".menu-toggle");
    const nav = $("#primary-nav");
    const close = () => {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Открыть меню");
      header.classList.remove("menu-open");
      nav.classList.remove("is-open");
    };
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      header.classList.toggle("menu-open", open);
      nav.classList.toggle("is-open", open);
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  }

  function initPolicy() {
    const dialog = $("#policy-dialog");
    $$("[data-policy-open]").forEach((button) => button.addEventListener("click", () => {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }));
    $(".dialog-close").addEventListener("click", () => dialog.close());
    $(".dialog-done").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  function initTaglineReveal() {
    const heading = $(".word-reveal");
    const words = heading.innerHTML.split(/(<br\s*\/?>)/i).map((part) => {
      if (/^<br\s*\/?>$/i.test(part)) return part;
      return part.split(/(\s+)/).map((piece) => /^\s+$/.test(piece) ? piece : `<span class="word">${piece}</span>`).join("");
    }).join("");
    heading.innerHTML = words;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    $$(".word-reveal .word").forEach((word) => observer.observe(word));
  }

  function init() {
    $$('a[href="#top"]').forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }));
    readSavedState();
    $("#dispute-category").value = state.disputeCategory;
    $(`input[name="docType"][value="${state.docType}"]`).checked = true;
    $(`input[name="workFormat"][value="${state.workFormat}"]`).checked = true;
    $(`input[name="urgency"][value="${state.urgency}"]`).checked = true;
    renderCalculator();
    const receivedDate = $("#received-date");
    if (!receivedDate.value) {
      const initialDate = new Date(getIrkutskDate().getTime() - 5 * 86400000);
      receivedDate.value = `${initialDate.getUTCFullYear()}-${String(initialDate.getUTCMonth() + 1).padStart(2, "0")}-${String(initialDate.getUTCDate()).padStart(2, "0")}`;
    }
    renderDeadline();
    setClock();
    window.setInterval(setClock, 30000);
    initMenu();
    initPhoneMask();
    initPolicy();
    initTaglineReveal();

    document.addEventListener("change", (event) => {
      if (event.target.matches('input[name="docType"], input[name="workFormat"], input[name="urgency"]')) {
        setCalcValue(event.target.name, event.target.value);
      }
    });
    $("#dispute-category").addEventListener("change", (event) => setCalcValue("disputeCategory", event.target.value));
    $("#deadline-type").addEventListener("change", renderDeadline);
    $("#received-date").addEventListener("change", renderDeadline);
    $("#deadline-to-calc").addEventListener("click", () => {
      const selected = deadlines[latestDeadlineType];
      setCalcValue("docType", selected.docType);
      setCalcValue("disputeCategory", selected.category);
      setCalcValue("urgency", latestDeadline && (new Date(`${latestDeadline}T00:00:00Z`) - getIrkutskDate()) / 86400000 <= 3 ? "urgent" : "standard");
      $("#calculator").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#criminal-toggle").addEventListener("click", (event) => {
      const isOpen = event.currentTarget.getAttribute("aria-expanded") === "true";
      event.currentTarget.setAttribute("aria-expanded", String(!isOpen));
      $("#criminal-message").hidden = isOpen;
    });

    $$("[data-scenario]").forEach((button) => button.addEventListener("click", () => {
      const scenarios = {
        summons: { docType: "objection", disputeCategory: "debt_contract", urgency: "standard" },
        order: { docType: "order_cancel", disputeCategory: "debt_contract", urgency: "urgent" },
        traffic: { docType: "koap_kas", disputeCategory: "auto_fssp", urgency: "urgent" }
      };
      Object.entries(scenarios[button.dataset.scenario]).forEach(([key, value]) => setCalcValue(key, value));
      $("#calculator").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    $$("[data-select-doc]").forEach((button) => button.addEventListener("click", () => {
      setCalcValue("docType", button.dataset.selectDoc);
      $("#calculator").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    $$("[data-geo]").forEach((button) => button.addEventListener("click", () => applyGeo(button.dataset.geo)));
    $$("[data-filter]").forEach((button) => button.addEventListener("click", () => {
      $$("[data-filter]").forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-pressed", String(active));
      });
      $$(".service-card").forEach((card) => card.classList.toggle("is-filtered-out", button.dataset.filter !== "all" && card.dataset.category !== button.dataset.filter));
    }));
    $$("[data-anatomy]").forEach((button) => button.addEventListener("click", () => {
      $$("[data-anatomy]").forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-pressed", String(active));
      });
      $("#anatomy-doc-title").textContent = anatomy[button.dataset.anatomy].label;
      renderHotspot(0, button.dataset.anatomy);
    }));
    function renderHotspot(index, type = $(".anatomy-tab.is-active").dataset.anatomy) {
      const [title, copy] = anatomy[type].points[index];
      $("#hotspot-number").textContent = `ПОЛЕ ${String(index + 1).padStart(2, "0")}`;
      $("#hotspot-title").textContent = title;
      $("#hotspot-copy").textContent = copy;
      $$(".hotspot").forEach((hotspot) => hotspot.classList.toggle("is-active", Number(hotspot.dataset.hotspot) === index));
    }
    $$(".hotspot").forEach((button) => button.addEventListener("click", () => renderHotspot(Number(button.dataset.hotspot))));
    $("#transfer-dossier").addEventListener("click", () => {
      $("#request").scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => $("#client-name").focus({ preventScroll: true }), 500);
    });
    $("#consent").addEventListener("change", updateConsentButtons);
    $("#telegram-button").addEventListener("click", () => openMessenger("telegram"));
    $("#whatsapp-button").addEventListener("click", () => openMessenger("whatsapp"));
    $("#request-form").addEventListener("submit", submitForm);
    $("#client-phone").addEventListener("input", () => { $("#form-error").hidden = true; });

    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    $$(".reveal").forEach((element) => revealObserver.observe(element));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
