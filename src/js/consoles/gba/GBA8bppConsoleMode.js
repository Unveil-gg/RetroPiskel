/**
 * GBA8bppConsoleMode - Game Boy Advance console mode (8bpp).
 *
 * Provides constraints for GBA sprite creation in 8bpp mode:
 * - RGB555 color space (32,768 colors, 5 bits per channel)
 * - Max 255 colors + transparent per sprite (8bpp = 256 palette entries)
 * - 8x8 tile size for 8BPP export
 * - 8BPP export tab with palette file
 *
 * 8bpp mode offers richer color depth at the cost of doubled memory usage
 * (64 bytes per tile vs 32 bytes for 4bpp). Ideal for detailed backgrounds
 * or complex sprites that need more than 16 colors.
 *
 * References:
 * - https://www.coranac.com/tonc/text/regobj.htm
 * - https://problemkaputt.de/gbatek.htm#lcdobjoverview
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * GBA 8bpp-specific console mode extending base ConsoleMode.
   */
  var GBA8bppConsoleMode = function () {
    pskl.consoles.ConsoleMode.call(this, {
      id: 'gba8bpp',
      name: 'Game Boy Advance (8bpp)',
      bodyClass: 'console-gba8bpp',
      palette: null,          // No fixed palette - uses RGB555 picker
      paletteType: 'rgb555',  // Signals quantized color picker mode
      maxColors: 255,         // 255 colors + transparent (8bpp = 256 total)
      tileSize: 8,            // 8x8 tiles for 8BPP
      defaultSize: {width: 32, height: 32},  // Larger default for 8bpp work
      exportTabs: ['gba8bpp'],
      themeVariables: {
        '--highlight-color': '#FF6347',
        '--console-accent': '#E05A3A',
        '--console-accent-text': '#FFA07A',
        '--console-accent-dim': '#B8472E',
        '--console-bg-dark': '#1a1210',
        '--console-bg-medium': '#2d1f1a',
        '--console-bg-light': '#3d2a22',
        '--console-border': '#6e4535',
        '--console-text': '#f8ece8'
      },
      badgeText: 'GBA8'
    });

    /** @type {number} Bytes per tile in 8BPP linear format. */
    this.BYTES_PER_TILE = 64;
  };

  pskl.utils.inherit(GBA8bppConsoleMode, pskl.consoles.ConsoleMode);

  /**
   * Snaps an 8-bit RGB value (0-255) to nearest GBA 5-bit value.
   * @param {number} value8bit - RGB component value 0-255
   * @return {number} Snapped 8-bit value (one of 32 valid GBA values)
   */
  GBA8bppConsoleMode.prototype.snapTo5Bit = function (value8bit) {
    var value5bit = Math.round(value8bit * 31 / 255);
    return Math.round(value5bit * 255 / 31);
  };

  /**
   * Gets the 5-bit GBA value (0-31) from an 8-bit value.
   * @param {number} value8bit - RGB component value 0-255
   * @return {number} GBA 5-bit value 0-31
   */
  GBA8bppConsoleMode.prototype.to5Bit = function (value8bit) {
    return Math.round(value8bit * 31 / 255);
  };

  /**
   * Snaps a hex color to the nearest valid GBA RGB555 color.
   * @param {string} hexColor - Hex color string (e.g., '#FF8040')
   * @return {string} Snapped hex color string
   */
  GBA8bppConsoleMode.prototype.snapColorToRGB555 = function (hexColor) {
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
  GBA8bppConsoleMode.prototype.colorToRGB555Bytes = function (hexColor) {
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
  GBA8bppConsoleMode.prototype.getPaletteData = function () {
    return null;  // No fixed palette - colors come from sprite
  };

  /**
   * Override: GBA validates colors by snapping, not rejecting.
   * Any color is valid after snapping to RGB555.
   * @param {string} color - Hex color string
   * @return {boolean} Always true (all colors snap to valid)
   */
  GBA8bppConsoleMode.prototype.isValidColor = function (color) {
    return true;
  };

  /**
   * Creates and returns a new GBA 8bpp console mode instance.
   * @return {GBA8bppConsoleMode}
   */
  ns.createGBA8bppMode = function () {
    return new GBA8bppConsoleMode();
  };

  // Export constants for use by exporters and other code
  ns.GBA8bppConstants = {
    MAX_SPRITE_COLORS: 255,   // 255 + transparent = 256 (8bpp)
    TILE_SIZE: 8,
    BYTES_PER_TILE: 64,       // 8bpp = 64 bytes per 8x8 tile
    BYTES_PER_PALETTE: 512,   // 256 colors × 2 bytes each
    COLOR_DEPTH: 5,           // 5 bits per RGB channel
    BITS_PER_PIXEL: 8         // 8bpp tile format
  };
})();
