/**
 * ConsoleMode - Base interface for retro console modes.
 *
 * Each console mode defines constraints and features specific to that
 * console's graphics capabilities (palette, tile size, color limits, etc.).
 *
 * Implementations should override methods as needed. Default implementations
 * provide no restrictions (standard Piskel behavior).
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * ConsoleMode constructor.
   * @param {Object} config - Configuration object for the console mode
   */
  ns.ConsoleMode = function (config) {
    /** @type {string} Unique identifier for this console mode. */
    this.id = config.id || 'unknown';

    /** @type {string} Display name shown in UI. */
    this.name = config.name || 'Unknown Console';

    /** @type {string} CSS class applied to body element for theming. */
    this.bodyClass = config.bodyClass || null;

    /**
     * @type {Array<string>|null}
     * Array of allowed hex colors, or null for unrestricted palette.
     */
    this.palette = config.palette || null;

    /**
     * @type {string|null}
     * Palette type identifier for special handling (e.g., 'rgb555' for GBC).
     * Null means standard palette behavior.
     */
    this.paletteType = config.paletteType || null;

    /**
     * @type {number|null}
     * Maximum non-transparent colors per sprite, or null for unlimited.
     */
    this.maxColors = config.maxColors || null;

    /**
     * @type {number|null}
     * Required tile size in pixels (dimensions must be multiples of this).
     * Null means no tile size restriction.
     */
    this.tileSize = config.tileSize || null;

    /**
     * @type {Array<string>}
     * Export tab IDs to show in addition to base tabs.
     */
    this.exportTabs = config.exportTabs || [];

    /**
     * @type {Object}
     * CSS custom properties for theming. Expected properties:
     *   --highlight-color: Main accent color
     *   --console-accent: Primary accent (decorative: badges, borders)
     *   --console-accent-text: Lighter accent for text on dark backgrounds
     *                          (must have 4.5:1 contrast ratio on bg-medium)
     *   --console-accent-dim: Darker accent for hover/pressed states
     *   --console-bg-dark: Darkest background
     *   --console-bg-medium: Medium background
     *   --console-bg-light: Lightest background
     *   --console-border: Border color
     *   --console-text: Text color
     */
    this.themeVariables = config.themeVariables || {};

    /**
     * @type {Object|null}
     * Recommended default sprite size {width, height}. Null for no preference.
     */
    this.defaultSize = config.defaultSize || null;

    /**
     * @type {string|null}
     * Badge text to display in corner (e.g., 'NES'). Null hides badge.
     */
    this.badgeText = config.badgeText || null;
  };

  /**
   * Validates that dimensions meet console requirements.
   * @param {number} width - Canvas width in pixels
   * @param {number} height - Canvas height in pixels
   * @return {Object} {valid: boolean, message: string}
   */
  ns.ConsoleMode.prototype.validateDimensions = function (width, height) {
    if (!this.tileSize) {
      return {valid: true, message: ''};
    }

    var validWidth = width % this.tileSize === 0;
    var validHeight = height % this.tileSize === 0;

    if (validWidth && validHeight) {
      return {valid: true, message: ''};
    }

    var msg = 'Dimensions must be multiples of ' + this.tileSize + '.';
    if (!validWidth) {
      msg += ' Width ' + width + ' is not valid.';
    }
    if (!validHeight) {
      msg += ' Height ' + height + ' is not valid.';
    }
    return {valid: false, message: msg};
  };

  /**
   * Validates color count meets console requirements.
   * @param {Array<string>} colors - Array of hex color strings
   * @return {Object} {valid: boolean, message: string, count: number}
   */
  ns.ConsoleMode.prototype.validateColors = function (colors) {
    if (!this.maxColors) {
      return {valid: true, message: '', count: colors.length};
    }

    // Filter out transparent colors
    var nonTransparent = colors.filter(function (c) {
      return c !== Constants.TRANSPARENT_COLOR &&
             c !== 'rgba(0, 0, 0, 0)';
    });

    var count = nonTransparent.length;

    if (count <= this.maxColors) {
      return {valid: true, message: '', count: count};
    }

    var msg = this.name + ' sprites support max ' + this.maxColors +
              ' colors (+ transparent). Current: ' + count + ' colors.';
    return {valid: false, message: msg, count: count};
  };

  /**
   * Checks if a color is valid for this console's palette.
   * @param {string} color - Hex color string
   * @return {boolean} True if color is allowed or palette is unrestricted
   */
  ns.ConsoleMode.prototype.isValidColor = function (color) {
    if (!this.palette) {
      return true;
    }
    var upperColor = color.toUpperCase();
    return this.palette.some(function (paletteColor) {
      return paletteColor.toUpperCase() === upperColor;
    });
  };

  /**
   * Gets palette formatted for Spectrum color picker (2D array).
   * @param {number} colorsPerRow - Number of colors per row
   * @return {Array<Array<string>>|null} 2D array or null if unrestricted
   */
  ns.ConsoleMode.prototype.getPaletteForSpectrum = function (colorsPerRow) {
    if (!this.palette) {
      return null;
    }

    colorsPerRow = colorsPerRow || 14;
    var rows = [];
    for (var i = 0; i < this.palette.length; i += colorsPerRow) {
      rows.push(this.palette.slice(i, i + colorsPerRow));
    }
    return rows;
  };

  /**
   * Gets extended palette data with metadata (e.g., register addresses).
   * Override in subclasses that have additional palette metadata.
   * @return {Array<Object>|null} Array of {color, ...metadata} or null
   */
  ns.ConsoleMode.prototype.getPaletteData = function () {
    return null;
  };

  /**
   * Returns whether this console mode has any restrictions.
   * @return {boolean} True if this mode restricts palette/colors/dimensions
   */
  ns.ConsoleMode.prototype.hasRestrictions = function () {
    return !!(this.palette || this.maxColors || this.tileSize);
  };
})();
