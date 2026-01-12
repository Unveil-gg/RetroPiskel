/**
 * GBAConsoleMode - Game Boy Advance console mode (4bpp).
 *
 * Provides constraints for GBA sprite creation in 4bpp mode:
 * - RGB555 color space (32,768 colors, 5 bits per channel)
 * - Max 15 colors + transparent per sprite (4bpp = 16 palette entries)
 * - 8x8 tile size for 4BPP export
 * - 4BPP export tab with palette file
 *
 * GBA uses the same RGB555 format as SNES/GBC, but with linear tile
 * encoding (2 pixels per byte as nibbles) instead of bitplane format.
 *
 * References:
 * - https://www.coranac.com/tonc/text/regobj.htm
 * - https://problemkaputt.de/gbatek.htm#lcdobjoverview
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * GBA 4bpp-specific console mode extending base ConsoleMode.
   */
  var GBAConsoleMode = function () {
    pskl.consoles.ConsoleMode.call(this, {
      id: 'gba',
      name: 'Game Boy Advance (4bpp)',
      bodyClass: 'console-gba',
      palette: null,          // No fixed palette - uses RGB555 picker
      paletteType: 'rgb555',  // Signals quantized color picker mode
      maxColors: 15,          // 15 colors + transparent (4bpp = 16 total)
      tileSize: 8,            // 8x8 tiles for 4BPP
      defaultSize: {width: 16, height: 16},  // Common GBA sprite size
      exportTabs: ['gba4bpp'],
      themeVariables: {
        '--highlight-color': '#00CED1',
        '--console-accent': '#20B2AA',
        '--console-accent-text': '#7FFFD4',
        '--console-accent-dim': '#008B8B',
        '--console-bg-dark': '#0a1520',
        '--console-bg-medium': '#122535',
        '--console-bg-light': '#1a3548',
        '--console-border': '#2d5a6e',
        '--console-text': '#e0f0f8'
      },
      badgeText: 'GBA'
    });

    /** @type {number} Bytes per tile in 4BPP linear format. */
    this.BYTES_PER_TILE = 32;
  };

  pskl.utils.inherit(GBAConsoleMode, pskl.consoles.ConsoleMode);

  /**
   * Snaps an 8-bit RGB value (0-255) to nearest GBA 5-bit value.
   * @param {number} value8bit - RGB component value 0-255
   * @return {number} Snapped 8-bit value (one of 32 valid GBA values)
   */
  GBAConsoleMode.prototype.snapTo5Bit = function (value8bit) {
    var value5bit = Math.round(value8bit * 31 / 255);
    return Math.round(value5bit * 255 / 31);
  };

  /**
   * Gets the 5-bit GBA value (0-31) from an 8-bit value.
   * @param {number} value8bit - RGB component value 0-255
   * @return {number} GBA 5-bit value 0-31
   */
  GBAConsoleMode.prototype.to5Bit = function (value8bit) {
    return Math.round(value8bit * 31 / 255);
  };

  /**
   * Snaps a hex color to the nearest valid GBA RGB555 color.
   * @param {string} hexColor - Hex color string (e.g., '#FF8040')
   * @return {string} Snapped hex color string
   */
  GBAConsoleMode.prototype.snapColorToRGB555 = function (hexColor) {
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
   * Converts a hex color to GBA BGR555 format (2 bytes, little-endian).
   * Format: byte0 = GGGRRRRR, byte1 = 0BBBBBGG
   * (Same format as SNES/GBC - 15-bit color)
   * @param {string} hexColor - Hex color string
   * @return {Uint8Array} 2-byte array in GBA palette format
   */
  GBAConsoleMode.prototype.colorToRGB555Bytes = function (hexColor) {
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
  GBAConsoleMode.prototype.getPaletteData = function () {
    return null;  // No fixed palette - colors come from sprite
  };

  /**
   * Override: GBA validates colors by snapping, not rejecting.
   * Any color is valid after snapping to RGB555.
   * @param {string} color - Hex color string
   * @return {boolean} Always true (all colors snap to valid)
   */
  GBAConsoleMode.prototype.isValidColor = function (color) {
    return true;
  };

  /**
   * Creates and returns a new GBA 4bpp console mode instance.
   * @return {GBAConsoleMode}
   */
  ns.createGBAMode = function () {
    return new GBAConsoleMode();
  };

  // Export constants for use by exporters and other code
  ns.GBAConstants = {
    MAX_SPRITE_COLORS: 15,    // 15 + transparent = 16 (4bpp)
    TILE_SIZE: 8,
    BYTES_PER_TILE: 32,       // 4bpp = 32 bytes per 8x8 tile
    BYTES_PER_PALETTE: 32,    // 16 colors × 2 bytes each
    COLOR_DEPTH: 5,           // 5 bits per RGB channel
    BITS_PER_PIXEL: 4         // 4bpp tile format
  };
})();
