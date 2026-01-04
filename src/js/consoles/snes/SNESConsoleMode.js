/**
 * SNESConsoleMode - Super Nintendo / Super Famicom console mode.
 *
 * Provides constraints for SNES sprite creation:
 * - RGB555 color space (32,768 colors, 5 bits per channel)
 * - Max 15 colors + transparent per sprite (4bpp = 16 palette entries)
 * - 8x8 tile size for 4BPP export
 * - 4BPP export tab with palette file
 *
 * SNES uses the same RGB555 format as GBC, but with 4bpp tiles
 * allowing 16 colors per sprite instead of GBC's 4 colors.
 *
 * References:
 * - https://snes.nesdev.org/wiki/Sprites
 * - https://github.com/alekmaul/pvsneslib/wiki/Sprites
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * SNES-specific console mode extending base ConsoleMode.
   */
  var SNESConsoleMode = function () {
    pskl.consoles.ConsoleMode.call(this, {
      id: 'snes',
      name: 'SNES / Super Famicom',
      bodyClass: 'console-snes',
      palette: null,          // No fixed palette - uses RGB555 picker
      paletteType: 'rgb555',  // Signals quantized color picker mode
      maxColors: 15,          // 15 colors + transparent (4bpp = 16 total)
      tileSize: 8,            // 8x8 tiles for 4BPP
      defaultSize: {width: 16, height: 16},  // Common SNES sprite size
      exportTabs: ['snes4bpp'],
      themeVariables: {
        '--highlight-color': '#CC66FF',
        '--console-accent': '#9933CC',
        '--console-accent-text': '#DDA0DD',
        '--console-accent-dim': '#6B238E',
        '--console-bg-dark': '#1a1520',
        '--console-bg-medium': '#251d2e',
        '--console-bg-light': '#362a42',
        '--console-border': '#5a4670',
        '--console-text': '#e0d8e8'
      },
      badgeText: 'SNES'
    });

    /** @type {number} Bytes per tile in 4BPP format. */
    this.BYTES_PER_TILE = 32;
  };

  pskl.utils.inherit(SNESConsoleMode, pskl.consoles.ConsoleMode);

  /**
   * Snaps an 8-bit RGB value (0-255) to nearest SNES 5-bit value.
   * @param {number} value8bit - RGB component value 0-255
   * @return {number} Snapped 8-bit value (one of 32 valid SNES values)
   */
  SNESConsoleMode.prototype.snapTo5Bit = function (value8bit) {
    var value5bit = Math.round(value8bit * 31 / 255);
    return Math.round(value5bit * 255 / 31);
  };

  /**
   * Gets the 5-bit SNES value (0-31) from an 8-bit value.
   * @param {number} value8bit - RGB component value 0-255
   * @return {number} SNES 5-bit value 0-31
   */
  SNESConsoleMode.prototype.to5Bit = function (value8bit) {
    return Math.round(value8bit * 31 / 255);
  };

  /**
   * Snaps a hex color to the nearest valid SNES RGB555 color.
   * @param {string} hexColor - Hex color string (e.g., '#FF8040')
   * @return {string} Snapped hex color string
   */
  SNESConsoleMode.prototype.snapColorToRGB555 = function (hexColor) {
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
   * Converts a hex color to SNES BGR555 format (2 bytes, little-endian).
   * Format: byte0 = GGGRRRRR, byte1 = 0BBBBBGG
   * (Same as GBC - both use 15-bit color)
   * @param {string} hexColor - Hex color string
   * @return {Uint8Array} 2-byte array in SNES palette format
   */
  SNESConsoleMode.prototype.colorToRGB555Bytes = function (hexColor) {
    var tc = window.tinycolor(hexColor);
    var rgb = tc.toRgb();

    var r5 = this.to5Bit(rgb.r);
    var g5 = this.to5Bit(rgb.g);
    var b5 = this.to5Bit(rgb.b);

    // BGR555 little-endian format:
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
  SNESConsoleMode.prototype.getPaletteData = function () {
    return null;  // No fixed palette - colors come from sprite
  };

  /**
   * Override: SNES validates colors by snapping, not rejecting.
   * Any color is valid after snapping to RGB555.
   * @param {string} color - Hex color string
   * @return {boolean} Always true (all colors snap to valid)
   */
  SNESConsoleMode.prototype.isValidColor = function (color) {
    return true;
  };

  /**
   * Creates and returns a new SNES console mode instance.
   * @return {SNESConsoleMode}
   */
  ns.createSNESMode = function () {
    return new SNESConsoleMode();
  };

  // Export constants for use by exporters and other code
  ns.SNESConstants = {
    MAX_SPRITE_COLORS: 15,    // 15 + transparent = 16 (4bpp)
    TILE_SIZE: 8,
    BYTES_PER_TILE: 32,       // 4bpp = 32 bytes per 8x8 tile
    BYTES_PER_PALETTE: 32,    // 16 colors × 2 bytes each
    COLOR_DEPTH: 5,           // 5 bits per RGB channel
    BITS_PER_PIXEL: 4         // 4bpp tile format
  };
})();

