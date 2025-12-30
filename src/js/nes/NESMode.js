/**
 * NES Mode service - LEGACY wrapper for backward compatibility.
 *
 * This module is deprecated. New code should use pskl.app.consoleRegistry
 * and the CONSOLE_MODE_CHANGED event instead.
 *
 * This legacy wrapper:
 * - Maintains the old nesMode.isEnabled() API
 * - Publishes NES_MODE_CHANGED for legacy listeners
 * - Syncs with the new ConsoleRegistry system
 */
(function () {
  var ns = $.namespace('pskl.nes');

  /**
   * NESMode constructor (legacy).
   * @deprecated Use pskl.app.consoleRegistry instead
   */
  ns.NESMode = function () {
    this.enabled = false;
  };

  /**
   * Initializes NES mode from user settings.
   * Syncs with new CONSOLE_MODE setting via UserSettings bridge.
   */
  ns.NESMode.prototype.init = function () {
    this.enabled = pskl.UserSettings.get(pskl.UserSettings.NES_MODE);
    this.updateBodyClass_();

    // Listen for both old and new setting changes
    $.subscribe(Events.USER_SETTINGS_CHANGED,
      this.onSettingsChange_.bind(this));

    // Listen to new console mode changes to stay in sync
    $.subscribe(Events.CONSOLE_MODE_CHANGED,
      this.onConsoleModeChanged_.bind(this));

    // Publish initial state for legacy listeners
    $.publish(Events.NES_MODE_CHANGED, [this.enabled]);
  };

  /**
   * Handles user settings changes (legacy path).
   * @param {Event} evt - The event object
   * @param {string} name - Setting name
   * @param {*} value - New setting value
   * @private
   */
  ns.NESMode.prototype.onSettingsChange_ = function (evt, name, value) {
    if (name === pskl.UserSettings.NES_MODE) {
      this.enabled = value;
      this.updateBodyClass_();
      $.publish(Events.NES_MODE_CHANGED, [value]);
    }
  };

  /**
   * Handles new console mode changes to keep legacy state in sync.
   * @param {Event} evt - The event object
   * @param {Object} data - {previous, current} console modes
   * @private
   */
  ns.NESMode.prototype.onConsoleModeChanged_ = function (evt, data) {
    var newEnabled = data.current && data.current.id === 'nes';
    if (this.enabled !== newEnabled) {
      this.enabled = newEnabled;
      this.updateBodyClass_();
      // Don't publish NES_MODE_CHANGED here to avoid double-firing
      // The UserSettings sync will handle it
    }
  };

  /**
   * Updates body class to toggle NES mode theming (legacy).
   * The new system uses console-nes class instead.
   * @private
   */
  ns.NESMode.prototype.updateBodyClass_ = function () {
    if (this.enabled) {
      document.body.classList.add('nes-mode');
    } else {
      document.body.classList.remove('nes-mode');
    }
  };

  /**
   * Returns whether NES mode is currently enabled.
   * @deprecated Use pskl.app.consoleRegistry.isActive('nes') instead
   * @return {boolean}
   */
  ns.NESMode.prototype.isEnabled = function () {
    return this.enabled;
  };

  /**
   * Enables or disables NES mode.
   * @deprecated Use pskl.UserSettings.set(CONSOLE_MODE, 'nes'/'default')
   * @param {boolean} enabled
   */
  ns.NESMode.prototype.setEnabled = function (enabled) {
    pskl.UserSettings.set(pskl.UserSettings.NES_MODE, enabled);
  };

  /**
   * Validates that dimensions are multiples of 8 (for CHR tiles).
   * @deprecated Use consoleMode.validateDimensions() instead
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @return {Object} {valid: boolean, message: string}
   */
  ns.NESMode.prototype.validateDimensions = function (width, height) {
    var tileSize = pskl.nes.NESColors.TILE_SIZE;
    var validWidth = width % tileSize === 0;
    var validHeight = height % tileSize === 0;

    if (validWidth && validHeight) {
      return { valid: true, message: '' };
    }

    var msg = 'Dimensions must be multiples of 8 for CHR export.';
    if (!validWidth) {
      msg += ' Width ' + width + ' is not valid.';
    }
    if (!validHeight) {
      msg += ' Height ' + height + ' is not valid.';
    }
    return { valid: false, message: msg };
  };

  /**
   * Validates color count (max 3 non-transparent colors).
   * @deprecated Use consoleMode.validateColors() instead
   * @param {Array} colors - Array of hex color strings
   * @return {Object} {valid: boolean, message: string, count: number}
   */
  ns.NESMode.prototype.validateColors = function (colors) {
    // Filter out transparent colors
    var nonTransparent = colors.filter(function (c) {
      return c !== Constants.TRANSPARENT_COLOR &&
             c !== 'rgba(0, 0, 0, 0)';
    });

    var max = pskl.nes.NESColors.MAX_SPRITE_COLORS;
    var count = nonTransparent.length;

    if (count <= max) {
      return { valid: true, message: '', count: count };
    }

    var msg = 'NES sprites support max ' + max + ' colors (+ transparent). ';
    msg += 'Current: ' + count + ' colors.';
    return { valid: false, message: msg, count: count };
  };

  /**
   * Checks if a color is in the official NES palette.
   * @deprecated Use consoleMode.isValidColor() instead
   * @param {string} color - Hex color string
   * @return {boolean}
   */
  ns.NESMode.prototype.isNESColor = function (color) {
    var upperColor = color.toUpperCase();
    return pskl.nes.NESColors.PALETTE.some(function (nesColor) {
      return nesColor.toUpperCase() === upperColor;
    });
  };
})();

