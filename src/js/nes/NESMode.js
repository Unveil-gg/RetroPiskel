/**
 * NES Mode service - manages NES mode state and validation.
 *
 * When NES mode is enabled, the editor provides soft constraints
 * to help users create valid NES/CHR sprites:
 * - Palette restricted to official NES colors
 * - Color count validation (max 3 + transparent)
 * - Dimension validation (multiples of 8)
 */
(function () {
  var ns = $.namespace('pskl.nes');

  /**
   * NESMode constructor.
   */
  ns.NESMode = function () {
    this.enabled = false;
  };

  /**
   * Initializes NES mode from user settings.
   */
  ns.NESMode.prototype.init = function () {
    this.enabled = pskl.UserSettings.get(pskl.UserSettings.NES_MODE);
    this.updateBodyClass_();
    $.subscribe(Events.USER_SETTINGS_CHANGED,
      this.onSettingsChange_.bind(this));

    // Publish initial state so listeners (e.g., PaletteController) can
    // reinitialize with the correct NES mode config
    $.publish(Events.NES_MODE_CHANGED, [this.enabled]);
  };

  /**
   * Handles user settings changes.
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
   * Updates body class to toggle NES mode theming.
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
   * @return {boolean}
   */
  ns.NESMode.prototype.isEnabled = function () {
    return this.enabled;
  };

  /**
   * Enables or disables NES mode.
   * @param {boolean} enabled
   */
  ns.NESMode.prototype.setEnabled = function (enabled) {
    pskl.UserSettings.set(pskl.UserSettings.NES_MODE, enabled);
  };

  /**
   * Validates that dimensions are multiples of 8 (for CHR tiles).
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

