/**
 * GBCConsoleMode - Game Boy Color console mode.
 *
 * Provides constraints for GBC sprite creation:
 * - RGB555 color space (32,768 colors, 5 bits per channel)
 * - Max 3 colors + transparent per sprite tile
 * - 8x8 tile size for 2BPP export
 * - 2BPP export tab with palette file
 *
 * Unlike NES/DMG which have fixed palettes, GBC allows any color from
 * the RGB555 space. Colors are automatically snapped to valid values.
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * GBC-specific console mode extending base ConsoleMode.
   */
  var GBCConsoleMode = function () {
    pskl.consoles.ConsoleMode.call(this, {
      id: 'gbc',
      name: 'Game Boy Color',
      bodyClass: 'console-gbc',
      palette: null,          // No fixed palette - uses RGB555 picker
      paletteType: 'rgb555',  // Signals quantized color picker mode
      maxColors: 3,           // 3 colors + transparent per tile
      tileSize: 8,            // 8x8 tiles for 2BPP
      defaultSize: {width: 16, height: 16},
      exportTabs: ['gbc2bpp'],
      themeVariables: {
        '--highlight-color': '#8B5CF6',
        '--console-accent': '#8B5CF6',
        '--console-accent-text': '#A78BFA',
        '--console-accent-dim': '#6D28D9',
        '--console-bg-dark': '#1a1a2e',
        '--console-bg-medium': '#16213e',
        '--console-bg-light': '#0f3460',
        '--console-border': '#533483',
        '--console-text': '#e8e8e8'
      },
      badgeText: 'GBC'
    });

    /** @type {number} Bytes per tile in 2BPP format. */
    this.BYTES_PER_TILE = 16;
  };

  pskl.utils.inherit(GBCConsoleMode, pskl.consoles.ConsoleMode);

  /**
   * Snaps an 8-bit RGB value (0-255) to nearest GBC 5-bit value.
   * @param {number} value8bit - RGB component value 0-255
   * @return {number} Snapped 8-bit value (one of 32 valid GBC values)
   */
  GBCConsoleMode.prototype.snapTo5Bit = function (value8bit) {
    // Convert 8-bit to 5-bit and back
    var value5bit = Math.round(value8bit * 31 / 255);
    return Math.round(value5bit * 255 / 31);
  };

  /**
   * Gets the 5-bit GBC value (0-31) from an 8-bit value.
   * @param {number} value8bit - RGB component value 0-255
   * @return {number} GBC 5-bit value 0-31
   */
  GBCConsoleMode.prototype.to5Bit = function (value8bit) {
    return Math.round(value8bit * 31 / 255);
  };

  /**
   * Snaps a hex color to the nearest valid GBC RGB555 color.
   * @param {string} hexColor - Hex color string (e.g., '#FF8040')
   * @return {string} Snapped hex color string
   */
  GBCConsoleMode.prototype.snapColorToRGB555 = function (hexColor) {
    var tc = window.tinycolor(hexColor);
    if (!tc.ok) {
      return hexColor;
    }

    var rgb = tc.toRgb();
    var snappedR = this.snapTo5Bit(rgb.r);
    var snappedG = this.snapTo5Bit(rgb.g);
    var snappedB = this.snapTo5Bit(rgb.b);

    return window.tinycolor({r: snappedR, g: snappedG, b: snappedB})
      .toHexString();
  };

  /**
   * Converts a hex color to GBC RGB555 format (2 bytes, little-endian).
   * Format: byte0 = GGGRRRRR, byte1 = 0BBBBBGG
   * @param {string} hexColor - Hex color string
   * @return {Uint8Array} 2-byte array in GBC palette format
   */
  GBCConsoleMode.prototype.colorToRGB555Bytes = function (hexColor) {
    var tc = window.tinycolor(hexColor);
    var rgb = tc.toRgb();

    var r5 = this.to5Bit(rgb.r);
    var g5 = this.to5Bit(rgb.g);
    var b5 = this.to5Bit(rgb.b);

    // GBC RGB555 little-endian format:
    // byte0 = lower 3 bits of G (bits 0-2) + R (bits 3-7)
    // byte1 = B (bits 0-4) + upper 2 bits of G (bits 5-6)
    var byte0 = ((g5 & 0x07) << 5) | r5;
    var byte1 = (b5 << 2) | ((g5 >> 3) & 0x03);

    return new Uint8Array([byte0, byte1]);
  };

  /**
   * Gets palette data with RGB555 values for export.
   * @return {Array<Object>|null} Array of {color, rgb555} or null
   */
  GBCConsoleMode.prototype.getPaletteData = function () {
    return null;  // No fixed palette - colors come from sprite
  };

  /**
   * Override: GBC validates colors by snapping, not rejecting.
   * Any color is valid after snapping to RGB555.
   * @param {string} color - Hex color string
   * @return {boolean} Always true (all colors snap to valid)
   */
  GBCConsoleMode.prototype.isValidColor = function (color) {
    return true;
  };

  /**
   * Creates and returns a new GBC console mode instance.
   * @return {GBCConsoleMode}
   */
  ns.createGBCMode = function () {
    return new GBCConsoleMode();
  };

  // Export constants for use by exporters and other code
  ns.GBCConstants = {
    MAX_SPRITE_COLORS: 3,
    TILE_SIZE: 8,
    BYTES_PER_TILE: 16,
    BYTES_PER_PALETTE: 8,  // 4 colors × 2 bytes each
    COLOR_DEPTH: 5         // 5 bits per RGB channel
  };
})();

