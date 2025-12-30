/**
 * ConsoleModeRegistry - Singleton registry for console modes.
 *
 * Manages registration, activation, and retrieval of console modes.
 * Publishes CONSOLE_MODE_CHANGED event when active mode changes.
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * ConsoleModeRegistry constructor.
   */
  ns.ConsoleModeRegistry = function () {
    /** @type {Object<string, pskl.consoles.ConsoleMode>} */
    this.modes_ = {};

    /** @type {pskl.consoles.ConsoleMode|null} */
    this.activeMode_ = null;
  };

  /**
   * Initializes the registry from user settings.
   */
  ns.ConsoleModeRegistry.prototype.init = function () {
    var savedModeId = pskl.UserSettings.get(pskl.UserSettings.CONSOLE_MODE);
    if (savedModeId && this.modes_[savedModeId]) {
      this.setActiveMode(savedModeId, true);
    } else if (this.modes_.default) {
      this.setActiveMode('default', true);
    }

    $.subscribe(Events.USER_SETTINGS_CHANGED,
      this.onSettingsChange_.bind(this));
  };

  /**
   * Handles user settings changes.
   * @param {Event} evt - The event object
   * @param {string} name - Setting name
   * @param {*} value - New setting value
   * @private
   */
  ns.ConsoleModeRegistry.prototype.onSettingsChange_ = function (
    evt, name, value
  ) {
    if (name === pskl.UserSettings.CONSOLE_MODE) {
      this.setActiveMode(value);
    }
  };

  /**
   * Registers a console mode.
   * @param {pskl.consoles.ConsoleMode} mode - Console mode to register
   */
  ns.ConsoleModeRegistry.prototype.register = function (mode) {
    if (!(mode instanceof pskl.consoles.ConsoleMode)) {
      console.error('Invalid console mode:', mode);
      return;
    }
    this.modes_[mode.id] = mode;
  };

  /**
   * Gets a registered console mode by ID.
   * @param {string} id - Console mode ID
   * @return {pskl.consoles.ConsoleMode|null}
   */
  ns.ConsoleModeRegistry.prototype.get = function (id) {
    return this.modes_[id] || null;
  };

  /**
   * Gets the currently active console mode.
   * @return {pskl.consoles.ConsoleMode|null}
   */
  ns.ConsoleModeRegistry.prototype.getActive = function () {
    return this.activeMode_;
  };

  /**
   * Gets all registered console mode IDs.
   * @return {Array<string>}
   */
  ns.ConsoleModeRegistry.prototype.getRegisteredIds = function () {
    return Object.keys(this.modes_);
  };

  /**
   * Gets all registered console modes.
   * @return {Array<pskl.consoles.ConsoleMode>}
   */
  ns.ConsoleModeRegistry.prototype.getAll = function () {
    var self = this;
    return Object.keys(this.modes_).map(function (id) {
      return self.modes_[id];
    });
  };

  /**
   * Sets the active console mode.
   * @param {string} modeId - ID of the mode to activate
   * @param {boolean=} skipSave - If true, don't save to UserSettings
   */
  ns.ConsoleModeRegistry.prototype.setActiveMode = function (
    modeId, skipSave
  ) {
    var newMode = this.modes_[modeId];
    if (!newMode) {
      console.error('Console mode not found:', modeId);
      return;
    }

    var previousMode = this.activeMode_;
    if (previousMode === newMode) {
      return;
    }

    // Remove previous mode's body class
    if (previousMode && previousMode.bodyClass) {
      document.body.classList.remove(previousMode.bodyClass);
      document.body.removeAttribute('data-console');
    }

    // Apply new mode's body class and data attribute
    this.activeMode_ = newMode;
    if (newMode.bodyClass) {
      document.body.classList.add(newMode.bodyClass);
    }
    if (newMode.badgeText) {
      document.body.setAttribute('data-console', newMode.badgeText);
    } else {
      document.body.removeAttribute('data-console');
    }

    // Apply theme variables
    this.applyThemeVariables_(newMode);

    // Save to settings (unless initializing)
    if (!skipSave) {
      pskl.UserSettings.set(pskl.UserSettings.CONSOLE_MODE, modeId);
    }

    // Publish change event
    $.publish(Events.CONSOLE_MODE_CHANGED, [{
      previous: previousMode,
      current: newMode
    }]);
  };

  /**
   * Applies CSS custom properties from the console mode.
   * @param {pskl.consoles.ConsoleMode} mode - Console mode
   * @private
   */
  ns.ConsoleModeRegistry.prototype.applyThemeVariables_ = function (mode) {
    var root = document.documentElement;
    var vars = mode.themeVariables || {};

    // Apply each variable
    Object.keys(vars).forEach(function (key) {
      root.style.setProperty(key, vars[key]);
    });
  };

  /**
   * Checks if a specific console mode is currently active.
   * @param {string} modeId - Console mode ID to check
   * @return {boolean}
   */
  ns.ConsoleModeRegistry.prototype.isActive = function (modeId) {
    return this.activeMode_ && this.activeMode_.id === modeId;
  };

  /**
   * Convenience method: checks if active mode has any restrictions.
   * @return {boolean}
   */
  ns.ConsoleModeRegistry.prototype.hasRestrictions = function () {
    return this.activeMode_ && this.activeMode_.hasRestrictions();
  };
})();
