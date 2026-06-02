(function () {
  const ROOT_ID = "cgpt-conversation-navigator";
  const ACTIVE_CLASS = "cgpt-nav-active-turn";
  const USER_TURN_CLASS = "cgpt-nav-user-turn";
  const POSITION_KEY = "cgpt-nav-position-v3";
  const supportedRoles = new Set(["user", "assistant", "system", "tool"]);

  if (document.getElementById(ROOT_ID)) {
    return;
  }

  const knownAiHostPatterns = [
    /(^|\.)chatgpt\.com$/,
    /(^|\.)chat\.openai\.com$/,
    /(^|\.)claude\.ai$/,
    /(^|\.)gemini\.google\.com$/,
    /(^|\.)aistudio\.google\.com$/,
    /(^|\.)copilot\.microsoft\.com$/,
    /(^|\.)perplexity\.ai$/,
    /(^|\.)poe\.com$/,
    /(^|\.)chat\.deepseek\.com$/,
    /(^|\.)chat\.mistral\.ai$/,
    /(^|\.)grok\.com$/,
    /(^|\.)meta\.ai$/,
    /(^|\.)kimi\.moonshot\.cn$/,
    /(^|\.)doubao\.com$/,
    /(^|\.)chat\.qwen\.ai$/,
    /(^|\.)yuanbao\.tencent\.com$/,
    /(^|\.)tongyi\.com$/,
    /(^|\.)chatglm\.cn$/,
    /(^|\.)yiyan\.baidu\.com$/,
    /(^|\.)chat\.baidu\.com$/
  ];

  const fallbackMessages = {
    ariaLabel: "AI chat export and jump toolbar",
    title: "Q/A",
    scanning: "Scanning",
    dragTitle: "Drag to move",
    collapseTitle: "Collapse",
    expandTitle: "Expand Q/A toolbar",
    jumpTitle: "Choose a question",
    previousTitle: "Previous question",
    nextTitle: "Next question",
    noQuestions: "No questions",
    questionOption: "Q $1",
    currentQuestion: "$1/$2",
    miniCount: "$1 Q",
    exportTypeLabel: "Content",
    exportFormatLabel: "Format",
    typeAll: "All",
    typeQuestions: "Questions",
    typeAnswers: "Answers",
    exportButton: "Export",
    rescanButton: "Rescan",
    mdFormat: "Markdown",
    txtFormat: "TXT",
    chatgptConversationTitle: "AI conversation",
    exportedContent: "Exported content",
    exportedAt: "Exported at",
    source: "Source",
    roleUser: "Question",
    roleAssistant: "Answer",
    roleSystem: "System",
    roleTool: "Tool",
    noExportContent: "Nothing to export",
    noQuestionFound: "No questions found",
    exportStarted: "Export started",
    rescanned: "Rescanned"
  };

  const state = {
    messages: [],
    messageCache: [],
    userTurns: [],
    currentIndex: -1,
    conversationKey: "",
    scanTimer: null,
    collapsed: false,
    exportOpen: false,
    questionsOpen: false,
    lastQuestionCount: -1,
    jumpLockUntil: 0,
    lastPassiveScanAt: 0,
    scrollFrame: 0,
    suppressClickUntil: 0
  };

  function t(key, substitutions) {
    const i18n =
      globalThis.chrome && chrome.i18n
        ? chrome.i18n
        : globalThis.browser && globalThis.browser.i18n
          ? globalThis.browser.i18n
          : null;
    const values = Array.isArray(substitutions)
      ? substitutions
      : substitutions === undefined
        ? []
        : [substitutions];
    const translated = i18n ? i18n.getMessage(key, values.map(String)) : "";
    let text = translated || fallbackMessages[key] || key;

    values.forEach((value, index) => {
      text = text.replaceAll(`$${index + 1}`, String(value));
    });

    return text;
  }

  function optionHtml(value, key) {
    return `<option value="${value}">${t(key)}</option>`;
  }

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="cgpt-nav-bar" role="region" aria-label="${t("ariaLabel")}">
      <button class="cgpt-nav-grip" data-cgpt-drag data-cgpt-action="collapse" title="${t("collapseTitle")}" aria-label="${t("collapseTitle")}">
        <strong>${t("title")}</strong>
        <span data-cgpt-mini-count>${t("scanning")}</span>
      </button>

      <button class="cgpt-nav-icon-button" data-cgpt-action="prev" title="${t("previousTitle")}" aria-label="${t("previousTitle")}">&#8593;</button>

      <button class="cgpt-nav-question-button" data-cgpt-action="toggle-questions" title="${t("jumpTitle")}">
        <span data-cgpt-current-question>${t("scanning")}</span>
      </button>

      <button class="cgpt-nav-icon-button" data-cgpt-action="next" title="${t("nextTitle")}" aria-label="${t("nextTitle")}">&#8595;</button>
      <button class="cgpt-nav-primary" data-cgpt-action="toggle-export" title="${t("exportButton")}">${t("exportButton")}</button>
      <button class="cgpt-nav-quiet" data-cgpt-action="rescan" title="${t("rescanButton")}">${t("rescanButton")}</button>
      <button class="cgpt-nav-icon-button" data-cgpt-action="collapse" title="${t("collapseTitle")}" aria-label="${t("collapseTitle")}">-</button>
      <div class="cgpt-nav-toast" data-cgpt-toast aria-live="polite"></div>
    </div>

    <button class="cgpt-nav-mini" data-cgpt-drag data-cgpt-action="expand" title="${t("expandTitle")}">
      <strong>${t("title")}</strong>
      <span data-cgpt-mini-pill>${t("scanning")}</span>
    </button>

    <div class="cgpt-nav-question-menu" data-cgpt-question-menu hidden>
      <div class="cgpt-nav-panel-title">${t("jumpTitle")}</div>
      <div class="cgpt-nav-question-list" data-cgpt-question-list></div>
    </div>

    <div class="cgpt-nav-export-panel" data-cgpt-export-panel hidden>
      <label class="cgpt-nav-field">
        <span>${t("exportTypeLabel")}</span>
        <select class="cgpt-nav-select" data-cgpt-export-type>
          ${optionHtml("all", "typeAll")}
          ${optionHtml("questions", "typeQuestions")}
          ${optionHtml("answers", "typeAnswers")}
        </select>
      </label>
      <label class="cgpt-nav-field">
        <span>${t("exportFormatLabel")}</span>
        <select class="cgpt-nav-select" data-cgpt-export-format>
          ${optionHtml("md", "mdFormat")}
          <option value="json">JSON</option>
          ${optionHtml("txt", "txtFormat")}
        </select>
      </label>
      <button class="cgpt-nav-primary cgpt-nav-export-confirm" data-cgpt-action="export">${t("exportButton")}</button>
    </div>
  `;
  root.hidden = !isKnownAiHost();
  document.documentElement.appendChild(root);

  const barNode = root.querySelector(".cgpt-nav-bar");
  const miniNode = root.querySelector(".cgpt-nav-mini");
  const miniCountNode = root.querySelector("[data-cgpt-mini-count]");
  const miniPillNode = root.querySelector("[data-cgpt-mini-pill]");
  const toastNode = root.querySelector("[data-cgpt-toast]");
  const currentQuestionNode = root.querySelector("[data-cgpt-current-question]");
  const questionMenuNode = root.querySelector("[data-cgpt-question-menu]");
  const questionListNode = root.querySelector("[data-cgpt-question-list]");
  const exportPanelNode = root.querySelector("[data-cgpt-export-panel]");
  const exportTypeSelect = root.querySelector("[data-cgpt-export-type]");
  const exportFormatSelect = root.querySelector("[data-cgpt-export-format]");

  function isKnownAiHost() {
    const host = location.hostname.toLowerCase();
    return knownAiHostPatterns.some((pattern) => pattern.test(host));
  }

  function isDoubaoHost() {
    return /(^|\.)doubao\.com$/.test(location.hostname.toLowerCase());
  }

  function updateVisibility() {
    root.hidden = !isKnownAiHost() && state.messages.length === 0;
  }

  const preciseRoleNodeSelectors = [
    "[data-message-author-role]",
    '[data-role="user"]',
    '[data-role="assistant"]',
    '[data-role="model"]',
    '[data-author="user"]',
    '[data-author="assistant"]',
    '[data-author-role="user"]',
    '[data-author-role="assistant"]',
    '[data-testid*="user-message" i]',
    '[data-testid*="assistant-message" i]',
    '[data-testid*="message-user" i]',
    '[data-testid*="message-assistant" i]',
    '[data-testid*="user-query" i]',
    '[data-testid*="model-response" i]',
    '[data-testid*="bot-message" i]',
    '[data-testid*="ai-message" i]',
    "user-query",
    "model-response"
  ].join(",");

  const broadRoleNodeSelectors = [
    '[aria-label*="user message" i]',
    '[aria-label*="assistant message" i]',
    '[aria-label*="model response" i]',
    '[class*="user-message" i]',
    '[class*="assistant-message" i]',
    '[class*="message-user" i]',
    '[class*="message-assistant" i]'
  ].join(",");

  const uiOnlyText = new Set([
    "展开",
    "收起",
    "展开/收起",
    "展开 / 收起",
    "显示更多",
    "显示更少",
    "show more",
    "show less",
    "expand",
    "collapse",
    "more",
    "less"
  ]);

  function getConversationScope() {
    return (
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.querySelector("[data-testid*='conversation' i]") ||
      document.body
    );
  }

  function getConversationKey() {
    return `${location.origin}${location.pathname}`;
  }

  function resetIfConversationChanged() {
    const nextKey = getConversationKey();
    if (state.conversationKey === nextKey) {
      return;
    }

    state.conversationKey = nextKey;
    state.messages = [];
    state.messageCache = [];
    state.userTurns = [];
    state.currentIndex = -1;
    state.lastQuestionCount = -1;
  }

  function getMessageContainer(node) {
    return (
      node.closest('article[data-testid^="conversation-turn-"]') ||
      node.closest("[data-testid^='conversation-turn-']") ||
      node.closest("[data-testid*='message' i]") ||
      node.closest("[data-testid*='response' i]") ||
      node.closest("[data-testid*='query' i]") ||
      node.closest("[data-role='message']") ||
      node.closest("[role='article']") ||
      node.closest("article") ||
      node
    );
  }

  function roleFromText(value) {
    const text = String(value || "").toLowerCase();
    if (!text) return "";
    if (/(^|\b|[_-])system(\b|[_-]|$)/.test(text)) {
      return "system";
    }
    if (/(^|\b|[_-])tool(\b|[_-]|$)/.test(text)) {
      return "tool";
    }
    if (/(^|\b|[_-])(user|human|you|prompt|query|question)(\b|[_-]|$)/.test(text)) {
      return "user";
    }
    if (/(^|\b|[_-])(assistant|model|bot|ai|answer|response|completion)(\b|[_-]|$)/.test(text)) {
      return "assistant";
    }
    if (/(用户|提问|我的消息|我说)/.test(text)) {
      return "user";
    }
    if (/(助手|回答|回复|模型|智能体)/.test(text)) {
      return "assistant";
    }
    return "";
  }

  function inferRole(node) {
    const directValues = [
      node.getAttribute("data-message-author-role"),
      node.getAttribute("data-role"),
      node.getAttribute("data-author"),
      node.getAttribute("data-author-role"),
      node.getAttribute("role")
    ];

    for (const value of directValues) {
      const role = roleFromText(value);
      if (role) return role;
    }

    const combined = [
      node.tagName,
      node.getAttribute("data-testid"),
      node.getAttribute("aria-label"),
      typeof node.className === "string" ? node.className : ""
    ].join(" ");

    return roleFromText(combined);
  }

  function cleanText(node) {
    const clone = node.cloneNode(true);
    clone
      .querySelectorAll(
        [
          "button",
          "nav",
          "menu",
          "script",
          "style",
          "textarea",
          "input",
          "select",
          "svg",
          "[contenteditable='true']",
          "[aria-hidden='true']"
        ].join(",")
      )
      .forEach((element) => element.remove());

    return (clone.innerText || clone.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function isInteractiveNode(node) {
    return Boolean(
      node.closest(
        [
          `#${ROOT_ID}`,
          "button",
          "[role='button']",
          "a[href]",
          "select",
          "textarea",
          "input",
          "summary",
          "details",
          "[contenteditable='true']"
        ].join(",")
      )
    );
  }

  function isUiOnlyText(text) {
    const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
    return uiOnlyText.has(normalized);
  }

  function isVisibleElement(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || 1) > 0
    );
  }

  function hasSameTextChild(node, text) {
    const normalizedText = normalizeMessageText(text);
    const children = Array.from(node.children || []);

    return children.some((child) => {
      if (!isVisibleElement(child)) {
        return false;
      }

      const childText = normalizeMessageText(cleanText(child));
      return childText && childText === normalizedText;
    });
  }

  function isLikelyRightSideUserBubble(node, text) {
    const rect = node.getBoundingClientRect();
    const normalized = normalizeMessageText(text);

    if (!normalized || normalized.length < 2 || normalized.length > 1200) {
      return false;
    }

    if (!isVisibleElement(node) || isInteractiveNode(node) || isUiOnlyText(normalized)) {
      return false;
    }

    if (hasSameTextChild(node, normalized)) {
      return false;
    }

    const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const rightAligned = rect.right > viewportWidth * 0.62 && rect.left > viewportWidth * 0.38;
    const bubbleSized = rect.width >= 80 && rect.width <= Math.min(760, viewportWidth * 0.58);
    const notComposer = !node.closest("form,[data-testid*='composer' i],[class*='composer' i],[class*='input' i]");

    return rightAligned && bubbleSized && notComposer;
  }

  function collectRightAlignedUserMessages(scope) {
    const candidates = Array.from(
      scope.querySelectorAll("div,p,span,section,article,[class]")
    );
    const seen = new Set();
    const messages = [];

    for (const node of candidates) {
      const text = cleanText(node);
      if (!isLikelyRightSideUserBubble(node, text)) {
        continue;
      }

      const key = normalizeMessageText(text);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      messages.push({
        role: "user",
        text,
        element: node,
        node
      });
    }

    messages.sort((left, right) => left.element.getBoundingClientRect().top - right.element.getBoundingClientRect().top);
    return messages;
  }

  function normalizeMessageText(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  function getStableMessageId(message) {
    const candidates = [
      message.node && message.node.getAttribute("data-message-id"),
      message.element && message.element.getAttribute("data-message-id"),
      message.node && message.node.id,
      message.element && message.element.id,
      message.node && message.node.getAttribute("data-testid"),
      message.element && message.element.getAttribute("data-testid")
    ].filter((value) => value && /[0-9]/.test(value));

    return candidates[0] || "";
  }

  function getMessageKey(message) {
    const stableId = getStableMessageId(message);
    if (stableId) {
      return `${message.role}:id:${stableId}`;
    }

    return `${message.role}:text:${normalizeMessageText(message.text)}`;
  }

  function mergeVisibleMessages(visibleMessages) {
    const messages = visibleMessages.map((message) => ({
      ...message,
      key: getMessageKey(message)
    }));

    if (!state.messageCache.length) {
      state.messageCache = messages;
      return;
    }

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      const existingIndex = state.messageCache.findIndex((cached) => cached.key === message.key);

      if (existingIndex >= 0) {
        state.messageCache[existingIndex] = {
          ...state.messageCache[existingIndex],
          ...message
        };
        continue;
      }

      let insertAt = state.messageCache.length;
      let foundAnchor = false;

      for (let previous = index - 1; previous >= 0; previous -= 1) {
        const previousIndex = state.messageCache.findIndex((cached) => cached.key === messages[previous].key);
        if (previousIndex >= 0) {
          insertAt = previousIndex + 1;
          foundAnchor = true;
          break;
        }
      }

      if (!foundAnchor) {
        for (let next = index + 1; next < messages.length; next += 1) {
          const nextIndex = state.messageCache.findIndex((cached) => cached.key === messages[next].key);
          if (nextIndex >= 0) {
            insertAt = nextIndex;
            break;
          }
        }
      }

      state.messageCache.splice(insertAt, 0, message);
    }
  }

  function collectMessages() {
    const scope = getConversationScope();
    let nodes = [];
    try {
      const preciseNodes = Array.from(scope.querySelectorAll(preciseRoleNodeSelectors));
      nodes = preciseNodes.length ? preciseNodes : Array.from(scope.querySelectorAll(broadRoleNodeSelectors));
    } catch (error) {
      nodes = Array.from(scope.querySelectorAll("[data-message-author-role]"));
    }
    const seen = new Set();
    const messages = [];

    for (const node of nodes) {
      if (isInteractiveNode(node)) {
        continue;
      }

      const role = inferRole(node);
      if (!supportedRoles.has(role)) {
        continue;
      }

      const text = cleanText(node);
      if (isUiOnlyText(text)) {
        continue;
      }

      const key = `${role}:${text.slice(0, 120)}:${text.length}`;
      if (!text || seen.has(key)) {
        continue;
      }

      seen.add(key);
      messages.push({
        role,
        text,
        element: getMessageContainer(node),
        node
      });
    }

    if (!messages.some((message) => message.role === "user") && isDoubaoHost()) {
      return collectRightAlignedUserMessages(scope);
    }

    return messages;
  }

  function refreshScan(options = {}) {
    resetIfConversationChanged();
    state.userTurns.forEach((turn) => turn.element.classList.remove(USER_TURN_CLASS));
    mergeVisibleMessages(collectMessages());
    state.messages = state.messageCache.slice();
    updateVisibility();
    state.userTurns = state.messages
      .filter((message) => message.role === "user")
      .map((message, index) => ({
        index,
        key: message.key,
        element: message.element,
        text: message.text
      }));

    state.userTurns.forEach((turn) => turn.element.classList.add(USER_TURN_CLASS));
    if (options.preserveCurrent) {
      if (!state.userTurns.length) {
        state.currentIndex = -1;
      } else if (state.currentIndex >= state.userTurns.length) {
        state.currentIndex = state.userTurns.length - 1;
      }
    } else {
      updateCurrentIndex();
    }
    updateQuestionList();
    updateCount();
  }

  function scheduleScan() {
    window.clearTimeout(state.scanTimer);
    state.scanTimer = window.setTimeout(refreshScan, 350);
  }

  function scheduleMutationScan() {
    if (!isKnownAiHost() && root.hidden) {
      const now = Date.now();
      if (now - state.lastPassiveScanAt < 1800) {
        return;
      }
      state.lastPassiveScanAt = now;
    }

    scheduleScan();
  }

  function getDocumentScroller() {
    return document.scrollingElement || document.documentElement;
  }

  function isDocumentScroller(scroller) {
    const documentScroller = getDocumentScroller();
    return scroller === documentScroller || scroller === document.documentElement || scroller === document.body;
  }

  function getScrollParent(element) {
    let node = element.parentElement;

    while (node && node !== document.body && node !== document.documentElement) {
      const style = window.getComputedStyle(node);
      const overflow = `${style.overflowY} ${style.overflow}`;
      if (/(auto|scroll|overlay)/i.test(overflow) && node.scrollHeight > node.clientHeight + 4) {
        return node;
      }
      node = node.parentElement;
    }

    return getDocumentScroller();
  }

  function getScrollTop(scroller) {
    return isDocumentScroller(scroller) ? window.scrollY || getDocumentScroller().scrollTop : scroller.scrollTop;
  }

  function setScrollTop(scroller, top) {
    const nextTop = Math.max(0, top);
    const previousScrollBehavior = scroller.style.scrollBehavior;
    const previousHtmlScrollBehavior = document.documentElement.style.scrollBehavior;
    const previousBodyScrollBehavior = document.body.style.scrollBehavior;

    scroller.style.scrollBehavior = "auto";
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.scrollBehavior = "auto";

    if (isDocumentScroller(scroller)) {
      getDocumentScroller().scrollTop = nextTop;
      document.documentElement.scrollTop = nextTop;
      document.body.scrollTop = nextTop;
      window.scrollTo(0, nextTop);
    } else {
      scroller.scrollTop = nextTop;
    }

    window.setTimeout(() => {
      scroller.style.scrollBehavior = previousScrollBehavior;
      document.documentElement.style.scrollBehavior = previousHtmlScrollBehavior;
      document.body.style.scrollBehavior = previousBodyScrollBehavior;
    }, 0);
  }

  function getMaxScrollTop(scroller) {
    if (isDocumentScroller(scroller)) {
      const documentScroller = getDocumentScroller();
      return Math.max(
        0,
        documentScroller.scrollHeight - window.innerHeight,
        document.documentElement.scrollHeight - window.innerHeight,
        document.body.scrollHeight - window.innerHeight
      );
    }

    return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  }

  function getBestKnownScroller() {
    const liveTurn = state.userTurns.find((turn) => turn.element && turn.element.isConnected);
    return liveTurn ? getScrollParent(liveTurn.element) : getDocumentScroller();
  }

  function approximateScrollToIndex(index) {
    const scroller = getBestKnownScroller();
    const denominator = Math.max(1, state.userTurns.length - 1);
    const ratio = Math.min(Math.max(index / denominator, 0), 1);
    setScrollTop(scroller, getMaxScrollTop(scroller) * ratio);
  }

  function scrollToTurn(element) {
    const offset = 92;
    const scroller = getScrollParent(element);
    const elementRect = element.getBoundingClientRect();
    let nextTop;

    if (isDocumentScroller(scroller)) {
      nextTop = getScrollTop(scroller) + elementRect.top - offset;
    } else {
      const scrollerRect = scroller.getBoundingClientRect();
      nextTop = scroller.scrollTop + elementRect.top - scrollerRect.top - offset;
    }

    setScrollTop(scroller, nextTop);

    window.requestAnimationFrame(() => {
      const correction = element.getBoundingClientRect().top - offset;
      if (Math.abs(correction) > 12) {
        setScrollTop(scroller, getScrollTop(scroller) + correction);
      }
    });
  }

  function updateCurrentIndex() {
    if (Date.now() < state.jumpLockUntil) {
      return;
    }

    if (!state.userTurns.length) {
      state.currentIndex = -1;
      return;
    }

    const liveTurns = state.userTurns.filter((turn) => turn.element && turn.element.isConnected);
    if (!liveTurns.length) {
      return;
    }

    const anchor = Math.min(window.innerHeight * 0.35, 280);
    let current = liveTurns[0].index;

    for (const turn of liveTurns) {
      if (turn.element.getBoundingClientRect().top <= anchor) {
        current = turn.index;
      } else {
        break;
      }
    }

    state.currentIndex = current;
  }

  function updateQuestionList() {
    const questionCount = state.userTurns.length;
    if (state.lastQuestionCount !== questionCount) {
      questionListNode.innerHTML = "";
      if (!questionCount) {
        const emptyNode = document.createElement("div");
        emptyNode.className = "cgpt-nav-empty";
        emptyNode.textContent = t("noQuestions");
        questionListNode.appendChild(emptyNode);
      } else {
        state.userTurns.forEach((turn, index) => {
          const button = document.createElement("button");
          const preview = turn.text.replace(/\s+/g, " ").trim().slice(0, 80);
          const label = document.createElement("strong");
          const previewNode = document.createElement("span");

          button.type = "button";
          button.className = "cgpt-nav-question-item";
          button.dataset.cgptQuestionIndex = String(index);
          button.title = preview;
          label.textContent = t("questionOption", index + 1);
          previewNode.textContent = preview;
          button.append(label, previewNode);
          questionListNode.appendChild(button);
        });
      }
      state.lastQuestionCount = questionCount;
    }

    questionListNode.querySelectorAll("[data-cgpt-question-index]").forEach((button) => {
      button.classList.toggle("is-current", Number(button.dataset.cgptQuestionIndex) === state.currentIndex);
    });
  }

  function updateCount() {
    const questionCount = state.userTurns.length;
    const current = state.currentIndex >= 0 ? state.currentIndex + 1 : "-";
    const currentText = questionCount ? t("currentQuestion", [current, questionCount]) : t("noQuestions");

    currentQuestionNode.textContent = currentText;
    miniCountNode.textContent = t("miniCount", questionCount);
    miniPillNode.textContent = questionCount ? currentText : t("noQuestions");
  }

  function highlightTurn(element) {
    document.querySelectorAll(`.${ACTIVE_CLASS}`).forEach((node) => {
      node.classList.remove(ACTIVE_CLASS);
    });
    element.classList.add(ACTIVE_CLASS);
    window.setTimeout(() => element.classList.remove(ACTIVE_CLASS), 1600);
  }

  function jumpToIndex(index) {
    if (!state.userTurns.length) {
      refreshScan({ preserveCurrent: true });
    }

    if (!state.userTurns.length) {
      showToast(t("noQuestionFound"));
      return;
    }

    const targetIndex = Math.min(Math.max(index, 0), state.userTurns.length - 1);
    const target = state.userTurns[targetIndex];

    state.jumpLockUntil = Date.now() + 1800;
    state.currentIndex = targetIndex;
    state.questionsOpen = false;
    updatePanels();
    updateQuestionList();
    updateCount();

    if (!target.element || !target.element.isConnected) {
      approximateScrollToIndex(targetIndex);
      window.setTimeout(() => {
        refreshScan({ preserveCurrent: true });
        const liveTarget = state.userTurns.find((turn) => turn.key === target.key && turn.element && turn.element.isConnected);
        if (liveTarget) {
          state.jumpLockUntil = Date.now() + 1800;
          state.currentIndex = liveTarget.index;
          scrollToTurn(liveTarget.element);
          highlightTurn(liveTarget.element);
          updateQuestionList();
          updateCount();
        }
      }, 220);
      return;
    }

    scrollToTurn(target.element);
    highlightTurn(target.element);

    window.setTimeout(() => {
      state.currentIndex = targetIndex;
      updateQuestionList();
      updateCount();
    }, 120);
  }

  function jumpToQuestion(direction) {
    if (!state.userTurns.length) {
      refreshScan({ preserveCurrent: true });
    }

    if (!state.userTurns.length) {
      showToast(t("noQuestionFound"));
      return;
    }

    updateCurrentIndex();
    jumpToIndex(state.currentIndex + direction);
  }

  function getTitle() {
    const title = (document.title || t("chatgptConversationTitle"))
      .replace(/\s*[-|]\s*ChatGPT\s*$/i, "")
      .replace(/^ChatGPT\s*[-|]\s*/i, "")
      .trim();
    return title || t("chatgptConversationTitle");
  }

  function exportTypeLabel(type) {
    if (type === "questions") return t("typeQuestions");
    if (type === "answers") return t("typeAnswers");
    return t("typeAll");
  }

  function roleLabel(role) {
    if (role === "user") return t("roleUser");
    if (role === "assistant") return t("roleAssistant");
    if (role === "system") return t("roleSystem");
    return t("roleTool");
  }

  function safeFilename(extension, exportType) {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const title = getTitle()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 70);
    return `${title || "chatgpt-conversation"}-${exportTypeLabel(exportType)}-${stamp}.${extension}`;
  }

  function getExportMessages(exportType) {
    refreshScan();
    if (exportType === "questions") {
      return state.messages.filter((message) => message.role === "user");
    }
    if (exportType === "answers") {
      return state.messages.filter((message) => message.role === "assistant");
    }
    return state.messages.filter((message) => message.role === "user" || message.role === "assistant");
  }

  function markdownExport(exportType) {
    const messages = getExportMessages(exportType);
    const counts = {
      user: 0,
      assistant: 0,
      system: 0,
      tool: 0
    };
    const lines = [
      `# ${getTitle()}`,
      "",
      `${t("exportedContent")}: ${exportTypeLabel(exportType)}`,
      `${t("exportedAt")}: ${new Date().toLocaleString()}`,
      `${t("source")}: ${location.href}`,
      ""
    ];

    for (const message of messages) {
      counts[message.role] += 1;
      lines.push(`## ${roleLabel(message.role)} ${counts[message.role]}`, "", message.text, "");
    }

    return lines.join("\n").trim() + "\n";
  }

  function textExport(exportType) {
    const messages = getExportMessages(exportType);
    const counts = {
      user: 0,
      assistant: 0,
      system: 0,
      tool: 0
    };
    const lines = [
      getTitle(),
      `${t("exportedContent")}: ${exportTypeLabel(exportType)}`,
      `${t("exportedAt")}: ${new Date().toLocaleString()}`,
      `${t("source")}: ${location.href}`,
      ""
    ];

    for (const message of messages) {
      counts[message.role] += 1;
      lines.push(`${roleLabel(message.role)} ${counts[message.role]}`, message.text, "");
    }

    return lines.join("\n").trim() + "\n";
  }

  function jsonExport(exportType) {
    const messages = getExportMessages(exportType);
    return JSON.stringify(
      {
        title: getTitle(),
        url: location.href,
        exportedAt: new Date().toISOString(),
        exportType,
        exportLabel: exportTypeLabel(exportType),
        counts: {
          questions: messages.filter((message) => message.role === "user").length,
          answers: messages.filter((message) => message.role === "assistant").length
        },
        messages: messages.map((message, index) => ({
          index: index + 1,
          role: message.role,
          label: roleLabel(message.role),
          text: message.text
        }))
      },
      null,
      2
    );
  }

  function buildExport(exportType, format) {
    if (format === "json") {
      return {
        text: jsonExport(exportType),
        extension: "json",
        mimeType: "application/json;charset=utf-8"
      };
    }
    if (format === "txt") {
      return {
        text: textExport(exportType),
        extension: "txt",
        mimeType: "text/plain;charset=utf-8"
      };
    }
    return {
      text: markdownExport(exportType),
      extension: "md",
      mimeType: "text/markdown;charset=utf-8"
    };
  }

  function downloadText(text, extension, mimeType, exportType) {
    if (!text.trim()) {
      showToast(t("noExportContent"));
      return;
    }

    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeFilename(extension, exportType);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(t("exportStarted"));
  }

  function exportConversation() {
    const exportType = exportTypeSelect.value;
    const format = exportFormatSelect.value;
    const output = buildExport(exportType, format);
    downloadText(output.text, output.extension, output.mimeType, exportType);
  }

  function showToast(message) {
    toastNode.textContent = message;
    toastNode.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toastNode.classList.remove("is-visible");
    }, 1800);
  }

  function updatePanels() {
    questionMenuNode.hidden = !state.questionsOpen || state.collapsed;
    exportPanelNode.hidden = !state.exportOpen || state.collapsed;
  }

  function closePanels() {
    state.questionsOpen = false;
    state.exportOpen = false;
    updatePanels();
  }

  function setCollapsed(collapsed) {
    state.collapsed = collapsed;
    if (collapsed) {
      closePanels();
    }
    barNode.hidden = collapsed;
    miniNode.hidden = !collapsed;
    updatePanels();
  }

  function updatePanelSide() {
    const rect = root.getBoundingClientRect();
    root.classList.toggle("is-left-side", rect.left > window.innerWidth / 2);
  }

  function clampPosition(left, top) {
    const rect = root.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);

    return {
      left: Math.min(Math.max(left, margin), maxLeft),
      top: Math.min(Math.max(top, margin), maxTop)
    };
  }

  function savePosition() {
    const rect = root.getBoundingClientRect();
    try {
      window.localStorage.setItem(
        POSITION_KEY,
        JSON.stringify({
          left: Math.round(rect.left),
          top: Math.round(rect.top)
        })
      );
    } catch (error) {
      // localStorage can be unavailable in some privacy modes.
    }
  }

  function applyPosition(left, top) {
    const next = clampPosition(left, top);
    root.style.left = `${next.left}px`;
    root.style.top = `${next.top}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
    updatePanelSide();
  }

  function restorePosition() {
    try {
      const raw = window.localStorage.getItem(POSITION_KEY);
      if (!raw) {
        updatePanelSide();
        return;
      }
      const position = JSON.parse(raw);
      if (Number.isFinite(position.left) && Number.isFinite(position.top)) {
        applyPosition(position.left, position.top);
      }
    } catch (error) {
      updatePanelSide();
    }
  }

  function initDrag() {
    const dragState = {
      pointerId: null,
      startX: 0,
      startY: 0,
      startLeft: 0,
      startTop: 0,
      action: "",
      moved: false
    };

    root.addEventListener("pointerdown", (event) => {
      const handle = event.target.closest("[data-cgpt-drag]");
      if (!handle || event.button !== 0) {
        return;
      }

      const rect = root.getBoundingClientRect();
      dragState.pointerId = event.pointerId;
      dragState.startX = event.clientX;
      dragState.startY = event.clientY;
      dragState.startLeft = rect.left;
      dragState.startTop = rect.top;
      dragState.action = handle.getAttribute("data-cgpt-action") || "";
      dragState.moved = false;
      root.setPointerCapture(event.pointerId);
    });

    root.addEventListener("pointermove", (event) => {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 3) {
        dragState.moved = true;
      }

      if (dragState.moved) {
        event.preventDefault();
        applyPosition(dragState.startLeft + deltaX, dragState.startTop + deltaY);
      }
    });

    root.addEventListener("pointerup", (event) => {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      if (dragState.moved) {
        state.suppressClickUntil = Date.now() + 250;
        savePosition();
      } else if (dragState.action === "collapse" || dragState.action === "expand") {
        state.suppressClickUntil = Date.now() + 250;
        setCollapsed(dragState.action === "collapse");
      }

      dragState.pointerId = null;
      dragState.action = "";
      try {
        root.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture may already be released by the browser.
      }
    });

    root.addEventListener("pointercancel", (event) => {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      dragState.pointerId = null;
      dragState.action = "";
    });
  }

  function isTypingTarget(target) {
    return Boolean(
      target &&
        (target.closest("textarea") ||
          target.closest("input") ||
          target.closest("[contenteditable='true']"))
    );
  }

  root.addEventListener("click", (event) => {
    if (Date.now() < state.suppressClickUntil) {
      event.preventDefault();
      return;
    }

    const questionButton = event.target.closest("[data-cgpt-question-index]");
    if (questionButton) {
      jumpToIndex(Number(questionButton.dataset.cgptQuestionIndex));
      return;
    }

    const button = event.target.closest("[data-cgpt-action]");
    if (!button) {
      return;
    }

    const action = button.getAttribute("data-cgpt-action");
    if (action === "prev") jumpToQuestion(-1);
    if (action === "next") jumpToQuestion(1);
    if (action === "toggle-questions") {
      refreshScan();
      state.questionsOpen = !state.questionsOpen;
      state.exportOpen = false;
      updatePanels();
    }
    if (action === "toggle-export") {
      state.exportOpen = !state.exportOpen;
      state.questionsOpen = false;
      updatePanels();
    }
    if (action === "export") exportConversation();
    if (action === "rescan") {
      refreshScan();
      showToast(t("rescanned"));
    }
    if (action === "collapse") setCollapsed(true);
    if (action === "expand") setCollapsed(false);
  });

  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) {
      closePanels();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!event.altKey || isTypingTarget(event.target)) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      jumpToQuestion(-1);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      jumpToQuestion(1);
    }
  });

  function handleAnyScroll() {
    if (state.scrollFrame) {
      return;
    }

    state.scrollFrame = window.requestAnimationFrame(() => {
      state.scrollFrame = 0;
      updateCurrentIndex();
      updateQuestionList();
      updateCount();
    });
  }

  document.addEventListener("scroll", handleAnyScroll, { passive: true, capture: true });
  window.addEventListener("scroll", handleAnyScroll, { passive: true });

  window.addEventListener("resize", () => {
    const rect = root.getBoundingClientRect();
    applyPosition(rect.left, rect.top);
    savePosition();
  });

  const observer = new MutationObserver(scheduleMutationScan);
  observer.observe(document.body, { childList: true, subtree: true });

  setCollapsed(false);
  restorePosition();
  initDrag();
  refreshScan();
})();
