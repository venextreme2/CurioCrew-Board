/* Holy Ship! — Story Library. Read-only public snapshot of narrative documentation.
   The game repository's narrative branch remains the editorial source of truth. */
(function () {
  "use strict";

  const VERSION = "20261008";
  const LIBRARY = "story/library/";
  const GAME_REPO = "https://github.com/venextreme2/Curio-Crew/";
  const ORIGINAL_NARRATIVE = GAME_REPO + "tree/narrative/story-bible-alpha-20261008/Documentation/Narrative";
  const DOCS = [
    { name: "README.md", title: "Как пользоваться", kicker: "НАВИГАЦИЯ И СТАТУСЫ" },
    { name: "StoryBible.md", title: "Мир и общий сюжет", kicker: "ПОЛНАЯ СЦЕНАРНАЯ БИБЛИЯ" },
    { name: "FullCampaign.md", title: "Все 20 островов", kicker: "ЧЕТЫРЕ ГЛАВЫ КАМПАНИИ" },
    { name: "AlphaCampaign.md", title: "Альфа: острова 1–5", kicker: "ПЕРВЫЙ АКТ" },
    { name: "Characters.md", title: "Персонажи", kicker: "КОРОЛЬ, NPC, ТОРГОВЦЫ" },
    { name: "NpcDialogueAudit.md", title: "NPC и диалоговый HUD", kicker: "РЕАЛЬНЫЕ ДАННЫЕ UNITY" },
    { name: "IntroCutscene.md", title: "Вступление C0", kicker: "ПОКАДРОВЫЙ СЦЕНАРИЙ" },
    { name: "ChapterCutscenes.md", title: "Кат-сцены C1–C4", kicker: "ПОСЛЕ КАЖДОЙ ГЛАВЫ" },
    { name: "NarrativeProgress.md", title: "Техническая интеграция", kicker: "ПРОГРЕСС И РАБОТА CODEX" }
  ];

  const byId = id => document.getElementById(id);
  const tabButtons = Array.from(document.querySelectorAll("[data-story-tab]"));
  const documentLinks = Array.from(document.querySelectorAll("[data-doc]"));
  const documentCache = new Map();
  const documentNames = new Set(DOCS.map(d => d.name));
  const markdown = typeof window.markdownit === "function"
    ? window.markdownit({ html: false, linkify: true, breaks: false })
    : null;

  let activeDoc = "README.md";
  let activeText = "";
  let viewRequest = 0;
  let fullCopyText = "";
  let fullCopyPromise = null;
  let toastTimeout = null;

  function setUrl(tab, doc) {
    try {
      const url = new URL(window.location.href);
      if (tab === "library" && doc) url.searchParams.set("doc", doc);
      if (tab === "team") url.searchParams.delete("doc");
      url.hash = tab === "library" ? "#library" : "#team";
      window.history.replaceState(null, "", url.toString());
    } catch (error) {
      // This URL is only a convenience; the content works without rewriting it.
    }
  }

  function selectTab(which, updateUrl) {
    const lib = which === "library";
    byId("storyTeam").hidden = lib;
    byId("storyLibrary").hidden = !lib;
    tabButtons.forEach(button => {
      const chosen = button.dataset.storyTab === which;
      button.classList.toggle("active", chosen);
      button.setAttribute("aria-selected", String(chosen));
      button.tabIndex = chosen ? 0 : -1;
    });
    if (updateUrl) setUrl(which, lib ? activeDoc : null);
    if (lib) {
      if (!activeText && !byId("storyDocBody").dataset.loaded) showDocument(activeDoc, false);
      prepareFullContext();
    }
  }

  function toast(message) {
    const element = byId("storyToast");
    element.textContent = message;
    element.classList.add("visible");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => element.classList.remove("visible"), 3400);
  }

  function documentFileUrl(name) {
    return LIBRARY + encodeURIComponent(name);
  }

  function getDocument(name) {
    if (!documentNames.has(name)) return Promise.reject(new Error("Неизвестный документ"));
    if (!documentCache.has(name)) {
      const promise = fetch(documentFileUrl(name) + "?v=" + VERSION, { cache: "default" })
        .then(response => {
          if (!response.ok) throw new Error("Не удалось загрузить " + name + " (HTTP " + response.status + ")");
          return response.text();
        })
        .catch(error => {
          documentCache.delete(name);
          throw error;
        });
      documentCache.set(name, promise);
    }
    return documentCache.get(name);
  }

  function repairDocumentLinks(container) {
    container.querySelectorAll("a[href]").forEach(link => {
      const value = link.getAttribute("href") || "";
      if (!value || value.startsWith("#")) return;
      const bare = value.split("#")[0].split("?")[0];
      if (documentNames.has(bare)) {
        link.href = "story.html?doc=" + encodeURIComponent(bare) + "#library";
        link.addEventListener("click", event => {
          event.preventDefault();
          selectTab("library", false);
          showDocument(bare, true);
        });
      } else if (value.startsWith("../../Assets/")) {
        const relative = value.replace("../../", "");
        link.href = GAME_REPO + "blob/develop/" + relative;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      } else if (/^https?:\/\//i.test(value)) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    });
  }

  function renderDocument(text) {
    const element = byId("storyDocBody");
    element.innerHTML = "";
    if (markdown) {
      element.innerHTML = markdown.render(text);
      repairDocumentLinks(element);
    } else {
      // CDN is optional: every file stays readable without the Markdown renderer.
      const pre = document.createElement("pre");
      pre.textContent = text;
      pre.style.whiteSpace = "pre-wrap";
      pre.style.overflowWrap = "anywhere";
      element.appendChild(pre);
    }
  }

  async function showDocument(name, updateUrl) {
    if (!documentNames.has(name)) return;
    const chosen = DOCS.find(doc => doc.name === name);
    const ticket = ++viewRequest;
    activeDoc = name;
    activeText = "";
    byId("storyDocBody").dataset.loaded = "";
    byId("storyDocBody").innerHTML = "";
    byId("storyDocTitle").textContent = chosen.title;
    byId("storyDocEyebrow").textContent = chosen.kicker;
    byId("storyRawLink").href = documentFileUrl(name);
    byId("storyDocState").hidden = false;
    byId("storyDocState").textContent = "Загрузка документа…";
    byId("copyStoryDoc").disabled = true;
    documentLinks.forEach(link => {
      const current = link.dataset.doc === name;
      link.classList.toggle("selected", current);
      if (current) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    if (updateUrl) setUrl("library", name);

    try {
      const text = await getDocument(name);
      if (ticket !== viewRequest) return;
      activeText = text;
      renderDocument(text);
      byId("storyDocBody").dataset.loaded = "true";
      byId("storyDocState").hidden = true;
      byId("copyStoryDoc").disabled = false;
    } catch (error) {
      if (ticket !== viewRequest) return;
      byId("storyDocState").textContent = "Ошибка загрузки. Попробуйте выбрать документ ещё раз или открыть Markdown напрямую.";
      const rawLink = byId("storyRawLink");
      rawLink.href = documentFileUrl(name);
      console.error(error);
    }
  }

  function makeCodexBrief() {
    return [
      "HOLY SHIP! — СЮЖЕТНЫЙ КОНТЕКСТ ДЛЯ CODEX (версия 0.1, 08.10.2026)",
      "",
      "Это справка о проекте, НЕ самостоятельное поручение менять код. Выполняй только конкретную задачу пользователя.",
      "Полная опубликованная библиотека: https://venextreme2.github.io/CurioCrew-Board/story.html?doc=README.md#library",
      "Исходная сценарная ветка: " + ORIGINAL_NARRATIVE,
      "Игровой репозиторий: " + GAME_REPO + "tree/develop",
      "",
      "СТРУКТУРА: 20 островов, 4 главы по 5 островов. Alpha — только глава I, острова 1–5; это НЕ конец игры.",
      "ОЗВУЧКА: записанные голоса только в пяти кат-сценах: C0 (вступление) и C1/C2/C3/C4 (финалы глав 1/2/3/4). Для Alpha производственно нужны лишь C0 и C1.",
      "ОБЫЧНЫЕ NPC: текстовые разговоры в уже существующем HUD, короткие нечленораздельные звуки речи и ambient. Не покупать и не создавать озвучивание текста NPC. Не ломать dialogue ducking и подавление generic UI click.",
      "ГЕЙМПЛЕЙ: 1–4 игрока, все обязательные миссии соло-проходимы. Физика, предметы и кооператив важнее долгих кат-сцен. Каждый остров должен иметь собственный ведущий игровой сценарий.",
      "АКТУАЛЬНО В UNITY: HUBTOWN_V2_REBUILT, Island01_GreenMaw, Island02_BuriedHarbor, Ocean01_Calm/Ocean02_Storm/Ocean03_ExtremeStorm. Острова 3–5 в сценарии пока концепции, а не готовые полноценные сцены.",
      "АЛЬФА: 1 — джунгли/свободное исследование; 2 — руины/пещеры/Cave Stalker; 3 — предложено перевозить тяжёлую тележку; 4 — предложено плыть длинной рекой; 5 — предложены туман/болотная навигация. Три последних идеи не закреплены технически.",
      "СЮЖЕТ: Король нанимает экипаж за добычей необычных предметов и особыми королевскими реликвиями, чтобы возвращать утраченные морские пути. Скрытый лор для сценаристов: Великий Фарватер был древней системой распределённых узлов, делающей некоторые курсы спокойнее ценой других районов.",
      "СПОЙЛЕРЫ: в первой главе игрок НЕ узнаёт истинную цену Фарватера, судьбу прежней экспедиции и финал короля. C1 лишь показывает продолжение карты за пределами знакомых островов.",
      "ПРОГРЕСС: сюжетные флаги записывать только после серверно подтверждённой доставки, просмотр/пропуск кат-сцены — локальное состояние клиента. Не менять FishNet и NPC/dialogue/HUD с нуля.",
      "ИСТОЧНИК ИСТИНЫ: различай реализованное (Unity develop), согласованные продуктовые ограничения и сценарные предложения (StoryBible/AlphaCampaign). Не объявляй draft-механику завершённой.",
      "QA: обычный короткий smoke pass для UI/сценарных изменений, без многочасовой evidence-инфраструктуры.",
      "",
      "Для подробных сценарных задач прочитай соответствующие Markdown-документы опубликованной библиотеки; для полного контекста используй кнопку «Скопировать всю библиотеку» на сайте."
    ].join("\n");
  }

  function prepareFullContext() {
    if (fullCopyText || fullCopyPromise) return;
    const button = byId("copyCodexFull");
    button.disabled = true;
    button.textContent = "Подготовка полной библиотеки…";
    fullCopyPromise = Promise.all(DOCS.map(doc => getDocument(doc.name))).then(contents => {
      const parts = [makeCodexBrief(), "", "===== ПОЛНАЯ СЦЕНАРНАЯ БИБЛИОТЕКА ====="];
      DOCS.forEach((doc, i) => {
        parts.push("", "===== ФАЙЛ: " + doc.name + " =====", contents[i]);
      });
      fullCopyText = parts.join("\n");
      button.disabled = false;
      button.textContent = "Скопировать всю библиотеку";
    }).catch(error => {
      fullCopyPromise = null;
      button.disabled = false;
      button.textContent = "Повторить загрузку библиотеки";
      console.error(error);
      toast("Не удалось подготовить документы. Проверьте соединение и повторите.");
    });
  }

  async function copyText(value, label) {
    if (!value) {
      toast("Текст ещё не загружен.");
      return;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Clipboard copy failed");
      }
      toast("Скопировано: " + label.toLocaleLowerCase("ru") + ".");
    } catch (error) {
      console.error(error);
      toast("Копирование недоступно. Откройте документ .md и скопируйте текст вручную.");
    }
  }

  tabButtons.forEach(button => {
    button.addEventListener("click", () => selectTab(button.dataset.storyTab, true));
    button.addEventListener("keydown", event => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const next = button.dataset.storyTab === "team" ? "library" : "team";
      const target = tabButtons.find(item => item.dataset.storyTab === next);
      selectTab(next, true);
      if (target) target.focus();
    });
  });

  documentLinks.forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    selectTab("library", false);
    showDocument(link.dataset.doc, true);
    if (window.innerWidth < 900) byId("storyDocTitle").scrollIntoView({ block: "start", behavior: "smooth" });
  }));

  byId("openLibrary").addEventListener("click", () => {
    selectTab("library", true);
    byId("storyLibrary").scrollIntoView({ block: "start", behavior: "smooth" });
  });

  byId("storyDocSearch").addEventListener("input", event => {
    const query = (event.target.value || "").trim().toLocaleLowerCase("ru");
    let matches = 0;
    documentLinks.forEach(link => {
      const hit = !query || link.textContent.toLocaleLowerCase("ru").includes(query);
      link.hidden = !hit;
      if (hit) matches++;
    });
    byId("storyNoResults").hidden = matches !== 0;
  });

  byId("copyTeam").addEventListener("click", () => {
    const text = byId("storyTeamText").innerText + "\n\n" +
      "Финал альфы: пять реликвий открывают продолжение карты, но не секрет всей игры.\n" +
      "NPC — текст и текущие короткие звуки речи; оплаченные голоса только для C0 и C1 в альфе.\n" +
      "Полная версия: 20 островов / 4 главы; главные кат-сцены C0+C1+C2+C3+C4.";
    copyText("HOLY SHIP! — КРАТКИЙ СЮЖЕТ ДЛЯ КОМАНДЫ\n\n" + text, "Краткое описание");
  });
  byId("copyCodexBrief").addEventListener("click", () => copyText(makeCodexBrief(), "Контекст для Codex"));
  byId("copyCodexFull").addEventListener("click", () => {
    if (!fullCopyText) {
      prepareFullContext();
      toast("Библиотека подготавливается. Повторите копирование после загрузки.");
      return;
    }
    copyText(fullCopyText, "Вся сценарная библиотека");
  });
  byId("copyStoryDoc").addEventListener("click", () => copyText(activeText, "Документ"));

  const urlDoc = new URLSearchParams(window.location.search).get("doc");
  if (urlDoc && documentNames.has(urlDoc)) {
    activeDoc = urlDoc;
    selectTab("library", false);
    showDocument(urlDoc, false);
  } else if (window.location.hash === "#library") {
    selectTab("library", false);
  } else {
    selectTab("team", false);
  }
})();
