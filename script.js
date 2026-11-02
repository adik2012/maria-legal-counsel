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
    private: { days: 15, title: "Определение суда", docType: "appeal", category: "debt_contract", statute: "ст. 332 ГПК РФ" },
    apk_days: { workingDays: 10, title: "Акт арбитражного суда (АПК РФ)", docType: "appeal", category: "arbitration", statute: "ч. 3 ст. 113, ч. 4 ст. 114 АПК РФ" }
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
      sections: [
        { heading: "Шапка и подсудность", fragment: "В Октябрьский районный суд г. Иркутска · Истец / Ответчик · Цена иска и госпошлина · ст. 131 ГПК РФ", title: "Суд и участники спора", copy: "Сверяем родовую и территориальную подсудность, наименование суда, сведения об истце и ответчике, цену иска и обязательные реквизиты. Содержание иска проверяется по ст. 131 ГПК РФ или ст. 125 АПК РФ; до подачи также учитывается досудебный порядок, если он обязателен." },
        { heading: "Обстоятельства и доказательства", fragment: "Обязательство подтверждается договором и платежными документами · Приложение № 1 — договор · Приложение № 2 — выписка по счету", title: "Факты, связанные с документами", copy: "Каждое юридически значимое обстоятельство излагается в хронологическом порядке и связывается с конкретным доказательством. Такая структура помогает суду соотнести утверждение с приложением, а сторонам — проверить относимость документов и полноту доказательственной базы." },
        { heading: "Правовое обоснование", fragment: "Ст. 309, 310 ГК РФ · Ст. 56, 67 ГПК РФ · Разъяснения Пленума Верховного Суда РФ", title: "Нормы и их применение", copy: "Правовое основание должно объяснять, почему установленные факты приводят к заявленному требованию. В зависимости от спора проверяются нормы ГК РФ и правила доказывания и оценки доказательств по ст. 56 и 67 ГПК РФ либо соответствующие положения АПК РФ; разъяснения Пленума применяются с учетом предмета дела." },
        { heading: "Расчет требований", fragment: "Основной долг · Период начисления · Неустойка или проценты · Цена иска и госпошлина", title: "Проверяемая арифметика", copy: "Расчет раскрывает состав требований, период и основание каждой суммы, учитывает платежи и исключает повторное начисление. Цена иска определяется по правилам процессуального закона; госпошлина рассчитывается по НК РФ с учетом характера и размера требований." },
        { heading: "Просительная часть и ходатайства", fragment: "ПРОШУ СУД: взыскать заявленную сумму и судебные расходы · Истребовать доказательства · ст. 57 ГПК РФ", title: "Конкретная просьба к суду", copy: "Просительная часть должна соответствовать основаниям и расчету, не выходить за пределы заявленной позиции и позволять исполнить судебный акт. При невозможности самостоятельно получить доказательство можно мотивировать ходатайство по ст. 57 ГПК РФ и указать, какое доказательство требуется и почему." }
      ]
    },
    objection: {
      label: "ВОЗРАЖЕНИЕ НА ИСК",
      sections: [
        { heading: "Суд и реквизиты дела", fragment: "В Кировский районный суд г. Иркутска · Дело № 2-1840/… · Истец / Ответчик", title: "Реквизиты конкретного дела", copy: "Возражения адресуются суду, в производстве которого находится спор, и содержат номер дела и данные участников. Проверяем процессуальный статус сторон, дату заседания и сведения из судебных извещений, чтобы отзыв был приобщен к нужному делу." },
        { heading: "Факты и документы", fragment: "Истец указывает на нарушение срока · Приложение № 1 — договор · Приложение № 2 — платежное поручение", title: "Ответ на фактические доводы", copy: "Каждый существенный довод иска сопоставляется с материалами дела. В отзыве отмечается, какие обстоятельства признаются, какие оспариваются и какими документами подтверждаются платежи, исполнение или переписка." },
        { heading: "Правовое обоснование", fragment: "Ст. 309, 404 ГК РФ · Ст. 35, 56, 149 ГПК РФ · Возражения по составу требований", title: "Позиция ответчика по закону", copy: "Нормы приводятся применительно к фактам, а не отдельным перечнем. Для гражданского процесса учитываются права стороны по ст. 35 ГПК РФ, распределение бремени доказывания по ст. 56 и подготовка дела по ст. 149; в арбитражном споре — требования ст. 131 АПК РФ." },
        { heading: "Контррасчет", fragment: "Заявлено: основной долг и начисления · Учтены платежи и спорные периоды · Ст. 333 ГК РФ — при наличии оснований", title: "Проверка суммы и начислений", copy: "Сверяем исходные данные, ставки, периоды, платежи и договорные условия. При наличии оснований отдельно мотивируется просьба о применении ст. 333 ГК РФ; вопрос о снижении неустойки разрешает суд с учетом обстоятельств дела." },
        { heading: "Просительная часть", fragment: "ПРОШУ СУД: учесть возражения и контррасчет · Истребовать доказательства · Рассмотреть ходатайства", title: "Просьбы, связанные с защитой", copy: "В конце отзыва четко указывается, какие требования оспариваются и какие процессуальные действия необходимы. Ходатайство об истребовании доказательств по ст. 57 ГПК РФ обосновывается невозможностью получить документ самостоятельно и его значением для спора." }
      ]
    },
    appeal: {
      label: "АПЕЛЛЯЦИОННАЯ ЖАЛОБА",
      sections: [
        { heading: "Суд и номер дела", fragment: "В Иркутский областной суд через суд первой инстанции · Дело № 2-1840/… · Заявитель / другие лица", title: "Надлежащий порядок подачи", copy: "Проверяем вид производства, суд первой инстанции, адресатов и срок обжалования. Для гражданского дела учитываются требования ст. 320–322 ГПК РФ; в арбитражном процессе применяются правила главы 34 АПК РФ, включая порядок подачи через суд первой инстанции." },
        { heading: "Факты и материалы дела", fragment: "Вывод суда о спорном обстоятельстве · Протокол заседания · Приложение № 1 — документ из материалов дела", title: "Связь доводов с материалами", copy: "Для каждого спорного вывода указываем, где он отражен в решении и какие материалы дела имеют значение. Новые доказательства требуют отдельного объяснения причин, по которым их нельзя было представить ранее, с учетом требований апелляционного производства." },
        { heading: "Основания пересмотра", fragment: "Неполное установление обстоятельств · Неверная оценка доказательств · Проверка по ст. 330 ГПК РФ", title: "Конкретные нарушения", copy: "Общие слова о несогласии не заменяют оснований для отмены или изменения решения. Доводы соотносятся с перечнем ст. 330 ГПК РФ либо нормами АПК РФ, показывается влияние возможной ошибки на выводы суда и подкрепляется позиция материалами дела." },
        { heading: "Расчет и госпошлина", fragment: "Оспариваемая часть решения · Сумма по доводам жалобы · Проверка госпошлины по НК РФ", title: "Объем обжалования", copy: "Отмечаем, какая часть решения оспаривается, как она отражается на присужденных суммах и соответствует ли расчет доводам жалобы. Проверяется вопрос госпошлины и подтверждающих документов по действующим положениям НК РФ." },
        { heading: "Просительная часть", fragment: "ПРОШУ СУД: отменить или изменить решение в указанной части · Приобщить документы при наличии оснований", title: "Требуемый вариант пересмотра", copy: "Просьба должна соответствовать полномочиям апелляционной инстанции и доводам жалобы. Проверяем перечень приложений, подтверждение направления копий другим участникам и процессуальные ходатайства; итог пересмотра определяет суд." }
      ]
    }
  };

  const storageKey = "mariaCalculator";
  const defaults = { docType: "order_cancel", disputeCategory: "debt_contract", workFormat: "doc_only", urgency: "standard" };
  let state = { ...defaults };
  let latestDeadline = "";
  let latestDeadlineType = "order";
  let cityWasCustomized = false;

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
    refreshMessagePreview();
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

  function isNonWorkingDay(utcDate) {
    const weekday = utcDate.getUTCDay();
    const monthDay = `${String(utcDate.getUTCMonth() + 1).padStart(2, "0")}-${String(utcDate.getUTCDate()).padStart(2, "0")}`;
    const fixedHolidays = new Set([
      "01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07", "01-08",
      "02-23", "03-08", "05-01", "05-09", "06-12", "11-04"
    ]);
    return weekday === 0 || weekday === 6 || fixedHolidays.has(monthDay);
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
      refreshMessagePreview();
      return;
    }
    const [year, month, day] = dateValue.split("-").map(Number);
    const received = new Date(Date.UTC(year, month - 1, day));
    let due;
    let calculationNote = "";
    if (type.workingDays) {
      due = new Date(received.getTime());
      let countedDays = 0;
      while (countedDays < type.workingDays) {
        due = new Date(due.getTime() + 86400000);
        if (!isNonWorkingDay(due)) countedDays += 1;
      }
      calculationNote = " Расчет выполнен в рабочих днях без учета выходных и официальных праздничных дней РФ (ч. 3 ст. 113 АПК РФ).";
    } else {
      due = type.months ? addCalendarMonth(received) : new Date(received.getTime() + type.days * 86400000);
      if (isNonWorkingDay(due)) {
        while (isNonWorkingDay(due)) due = new Date(due.getTime() + 86400000);
        calculationNote = " Окончание срока перенесено с нерабочего (выходного или праздничного) дня на ближайший рабочий день (ч. 2 ст. 108 ГПК РФ).";
      }
    }
    const deliveryNote = " Дата является предварительным ориентиром и требует сверки со способом доставки (почтовый конверт РПО, Госуслуги, публикация в картотеке суда).";
    const today = getIrkutskDate();
    const remaining = Math.round((due.getTime() - today.getTime()) / 86400000);
    latestDeadline = `${due.getUTCFullYear()}-${String(due.getUTCMonth() + 1).padStart(2, "0")}-${String(due.getUTCDate()).padStart(2, "0")}`;
    const dueText = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(due);
    let marker;
    let title;
    let note = `${type.statute}. Течение срока начинается на следующий день после даты получения.${calculationNote}${deliveryNote}`;
    if (remaining < 0) {
      result.classList.add("status-expired");
      marker = "СРОК ИСТЕК";
      title = `Крайняя дата: ${dueText}`;
      note = `Проверьте возможность ходатайства о восстановлении срока. Это зависит от причин пропуска и применимого порядка.${calculationNote}${deliveryNote}`;
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
    refreshMessagePreview();
  }

  function currentChecklistText() {
    return [...checklistBase[state.docType], ...(categoryChecklist[state.disputeCategory] || [])].map((item) => `• ${item}`).join("\n");
  }

  function composeMessage() {
    const dateLabel = latestDeadline ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${latestDeadline}T00:00:00Z`)) : "не указан";
    const cityInput = $("#client-city");
    const geoMode = document.querySelector('[data-geo="irkutsk"]').getAttribute("aria-pressed") === "true" ? "Иркутск" : "дистанционно, вся Россия";
    const city = cityInput.value.trim() || geoMode;
    const price = currentPrice();
    const deadlineType = deadlines[latestDeadlineType];
    return [
      "ДЕМОНСТРАЦИОННАЯ КАРТОЧКА · НЕ ОТПРАВЛЯЕТСЯ И НЕ ПЕРЕДАЕТСЯ",
      `Документ: ${labels.documents[state.docType]}`,
      `Категория: ${labels.categories[state.disputeCategory]}`,
      `Формат: ${labels.formats[state.workFormat]}`,
      `Срочность: ${labels.urgency[state.urgency]}`,
      `Проверяемый акт: ${deadlineType.title} · ${deadlineType.statute}`,
      `Предварительный ориентир крайней даты подачи: ${dateLabel}`,
      `Город / суд: ${city}`,
      `Формат связи: ${geoMode}`,
      `Предварительный ориентир стоимости: ${formatMoney(price.total)} ₽`,
      `Разбивка: базовая цена ${formatMoney(prices.documents[state.docType])} ₽ × коэффициент категории ${prices.categories[state.disputeCategory].toLocaleString("ru-RU")} = ${formatMoney(price.documentCost)} ₽; формат + ${formatMoney(prices.formats[state.workFormat])} ₽; сумма до срочности ${formatMoney(price.subtotal)} ₽; срочность × ${prices.urgency[state.urgency].toLocaleString("ru-RU")}; итог ${formatMoney(price.total)} ₽.`,
      "Что подготовить:\n" + currentChecklistText()
    ].join("\n");
  }

  function refreshMessagePreview() {
    const preview = $("#message-preview");
    if (preview) preview.textContent = composeMessage();
  }

  function updateConsentButtons() {
    const submitButton = $("#submit-button");
    submitButton.disabled = !$("#consent").checked;
    submitButton.setAttribute("aria-disabled", String(submitButton.disabled));
  }

  function applyGeo(mode) {
    $$("[data-geo]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.geo === mode)));
    $$("[data-geo-content]").forEach((element) => { element.hidden = element.dataset.geoContent !== mode; });
    const localFormat = $('[data-local-format]');
    localFormat.classList.toggle("geo-muted", mode !== "irkutsk");
    $("#format-hint").textContent = mode === "irkutsk"
      ? "Очный формат доступен для Иркутска и Иркутского района."
      : "Для других регионов доступны документ и дистанционная подача.";
    const cityInput = $("#client-city");
    const standardCity = cityInput.value.trim() === "" || cityInput.value.trim() === "Иркутск";
    if (!cityWasCustomized || standardCity) {
      cityWasCustomized = false;
      if (mode === "irkutsk") {
        cityInput.value = "Иркутск";
        cityInput.placeholder = "Например: Иркутск, Кировский районный суд";
      } else {
        cityInput.value = "";
        cityInput.placeholder = "Укажите ваш город или суд в регионе РФ";
      }
    }
    refreshMessagePreview();
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

  function submitForm(event) {
    event.preventDefault();
    if (!$("#consent").checked) {
      showFormError("Подтвердите ознакомление с демонстрационным режимом.");
      return;
    }
    const form = $("#request-form");
    $("#form-error").hidden = true;
    $("#form-success").hidden = true;
    showFormSuccess("Демо-проверка выполнена. Данные не отправлялись, не обрабатывались и не сохранялись.");
    form.reset();
    updateConsentButtons();
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
    updateConsentButtons();
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
        bailiff: { docType: "koap_kas", disputeCategory: "auto_fssp", urgency: "urgent" },
        appeal: { docType: "appeal", disputeCategory: "debt_contract", urgency: "urgent" },
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
    const cityInput = $("#client-city");
    cityInput.addEventListener("input", () => {
      const city = cityInput.value.trim();
      cityWasCustomized = city !== "" && city !== "Иркутск";
      refreshMessagePreview();
    });
    $("#request-form").addEventListener("reset", () => {
      window.setTimeout(() => {
        cityWasCustomized = false;
        const isIrkutsk = document.querySelector('[data-geo="irkutsk"]').getAttribute("aria-pressed") === "true";
        cityInput.value = isIrkutsk ? "Иркутск" : "";
        cityInput.placeholder = isIrkutsk
          ? "Например: Иркутск, Кировский районный суд"
          : "Укажите ваш город или суд в регионе РФ";
        refreshMessagePreview();
      }, 0);
    });
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
      renderDocument(button.dataset.anatomy);
      renderDocumentSection(0, button.dataset.anatomy);
    }));
    function renderDocument(type) {
      anatomy[type].sections.forEach((sectionData, index) => {
        const section = $(`.doc-section[data-hotspot="${index}"]`);
        section.querySelector(".doc-section-heading").textContent = sectionData.heading;
        section.querySelector(".doc-section-text").textContent = sectionData.fragment;
      });
    }
    function renderDocumentSection(index, type = $(".anatomy-tab.is-active").dataset.anatomy) {
      const sectionData = anatomy[type].sections[index];
      const selectedSection = $(`.doc-section[data-hotspot="${index}"]`);
      $$(".doc-section").forEach((section) => {
        const active = section === selectedSection;
        section.classList.toggle("is-active", active);
        section.setAttribute("aria-pressed", String(active));
      });
      selectedSection.querySelector(".doc-section-heading").textContent = sectionData.heading;
      selectedSection.querySelector(".doc-section-text").textContent = sectionData.fragment;
      $("#hotspot-number").textContent = `РАЗДЕЛ ${String(index + 1).padStart(2, "0")}`;
      $("#hotspot-title").textContent = sectionData.title;
      $("#hotspot-copy").textContent = sectionData.copy;
    }
    $$(".doc-section").forEach((button) => button.addEventListener("click", () => renderDocumentSection(Number(button.dataset.hotspot))));
    renderDocument("claim");
    renderDocumentSection(0, "claim");
    $("#transfer-dossier").addEventListener("click", () => {
      $("#request").scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => $("#client-name").focus({ preventScroll: true }), 500);
    });
    $("#consent").addEventListener("change", updateConsentButtons);
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
