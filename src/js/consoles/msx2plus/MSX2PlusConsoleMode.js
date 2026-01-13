/**
 * MSX2PlusConsoleMode - MSX2+ (V9958 VDP) console mode.
 *
 * Theme: "Space Manbow" - Cosmic purple inspired by Konami's
 * 1989 shooter showpiece that pushed the V9958 to its limits.
 *
 * Provides constraints for MSX2+ sprite creation:
 * - RGB333 color space (512 colors, 3 bits per channel)
 * - YJK mode available (19,268 colors) - SCREEN 10/11/12
 * - Max 15 colors + transparent per sprite (SCREEN 5: 4bpp)
 * - 8x8 or 16x16 sprite sizes with multi-color support
 * - 4BPP pattern table export with palette
 *
 * MSX2+ uses the V9958 VDP which extends V9938 with:
 * - YJK color encoding (similar to YCbCr)
 * - Hardware horizontal scroll
 * - SCREEN 10/11/12 modes
 *
 * For sprite work, MSX2+ is functionally identical to MSX2.
 * The YJK modes are primarily used for backgrounds/bitmaps.
 *
 * References:
 * - https://www.msx.org/wiki/V9958
 * - https://www.msx.org/wiki/MSX2%2B
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * MSX2+-specific console mode extending base ConsoleMode.
   */
  var MSX2PlusConsoleMode = function () {
    pskl.consoles.ConsoleMode.call(this, {
      id: 'msx2plus',
      name: 'MSX2+ (V9958)',
      bodyClass: 'console-msx2plus',
      palette: null,          // No fixed palette - uses RGB333 picker
      paletteType: 'rgb333',  // Signals 9-bit color picker mode
      maxColors: 15,          // 15 colors + transparent (4bpp = 16 total)
      tileSize: 8,            // 8x8 tiles for 4BPP
      defaultSize: {width: 16, height: 16},  // Common MSX2+ sprite size
      exportTabs: ['msx2plus4bpp'],
      themeVariables: {
        '--highlight-color': '#8040FF',
        '--console-accent': '#8040FF',
        '--console-accent-text': '#B080FF',
        '--console-accent-dim': '#5020C0',
        '--console-bg-dark': '#08080E',
        '--console-bg-medium': '#100E18',
        '--console-bg-light': '#1A1824',
        '--console-border': '#302848',
        '--console-text': '#E0D8F0'
      },
      badgeText: 'MSX2+'
    });

    /** @type {number} Bytes per 8x8 tile in 4BPP format. */
    this.BYTES_PER_TILE = 32;
  };

  pskl.utils.inherit(MSX2PlusConsoleMode, pskl.consoles.ConsoleMode);

  /**
   * Snaps an 8-bit RGB value (0-255) to nearest V9958 3-bit value.
   * V9958 uses 3 bits per channel = 8 levels (0-7).
   * @param {number} value8bit - RGB component value 0-255
   * @return {number} Snapped 8-bit value (one of 8 valid V9958 values)
   */
  MSX2PlusConsoleMode.prototype.snapTo3Bit = function (value8bit) {
    var value3bit = Math.round(value8bit * 7 / 255);
    return Math.round(value3bit * 255 / 7);
  };

  /**
   * Gets the 3-bit V9958 value (0-7) from an 8-bit value.
   * @param {number} value8bit - RGB component value 0-255
   * @return {number} V9958 3-bit value 0-7
   */
  MSX2PlusConsoleMode.prototype.to3Bit = function (value8bit) {
    return Math.round(value8bit * 7 / 255);
  };

  /**
   * Snaps a hex color to the nearest valid V9958 RGB333 color.
   * @param {string} hexColor - Hex color string (e.g., '#FF8040')
   * @return {string} Snapped hex color string
   */
  MSX2PlusConsoleMode.prototype.snapColorToRGB333 = function (hexColor) {
    var tc = window.tinycolor(hexColor);
    if (!tc.ok) {
      return hexColor;
    }

    var rgb = tc.toRgb();
    var snappedR = this.snapTo3Bit(rgb.r);
    var snappedG = this.snapTo3Bit(rgb.g);
    var snappedB = this.snapTo3Bit(rgb.b);

    return window.tinycolor({r: snappedR, g: snappedG, b: snappedB})
      .toHexString();
  };

  /**
   * Converts a hex color to V9958 palette register format (2 bytes).
   * Format: 0RRR0GGG 0BBB0000 (same as V9938)
   * @param {string} hexColor - Hex color string
   * @return {Uint8Array} 2-byte array in V9958 palette format
   */
  MSX2PlusConsoleMode.prototype.colorToPaletteBytes = function (hexColor) {
    var tc = window.tinycolor(hexColor);
    var rgb = tc.toRgb();

    var r3 = this.to3Bit(rgb.r);
    var g3 = this.to3Bit(rgb.g);
    var b3 = this.to3Bit(rgb.b);

    // V9958 palette format: 0RRR0GGG 0BBB0000 (same as V9938)
    var byte0 = (r3 << 4) | g3;
    var byte1 = (b3 << 4);

    return new Uint8Array([byte0, byte1]);
  };

  /**
   * Gets palette data with RGB333 values for export.
   * @return {Array<Object>|null} Array of {color, rgb333} or null
   */
  MSX2PlusConsoleMode.prototype.getPaletteData = function () {
    return null;  // No fixed palette - colors come from sprite
  };

  /**
   * Override: MSX2+ validates colors by snapping, not rejecting.
   * Any color is valid after snapping to RGB333.
   * @param {string} color - Hex color string
   * @return {boolean} Always true (all colors snap to valid)
   */
  MSX2PlusConsoleMode.prototype.isValidColor = function (color) {
    return true;
  };

  /**
   * Creates and returns a new MSX2+ console mode instance.
   * @return {MSX2PlusConsoleMode}
   */
  ns.createMSX2PlusMode = function () {
    return new MSX2PlusConsoleMode();
  };

  // Export constants for use by exporters and other code
  ns.MSX2PlusConstants = {
    MAX_SPRITE_COLORS: 15,    // 15 + transparent = 16 (4bpp)
    TILE_SIZE: 8,
    BYTES_PER_TILE: 32,       // 4bpp = 32 bytes per 8x8 tile
    BYTES_PER_PALETTE: 32,    // 16 colors × 2 bytes each
    COLOR_DEPTH: 3,           // 3 bits per RGB channel (standard mode)
    BITS_PER_PIXEL: 4,        // 4bpp tile format
    TOTAL_COLORS: 512,        // 8 × 8 × 8 = 512 possible RGB333 colors
    YJK_COLORS: 19268,        // YJK mode can display ~19,268 colors
    SPRITE_SIZES: [8, 16],    // 8x8 or 16x16 sprites supported
    SCREEN_MODES: {
      SCREEN5: {width: 256, height: 212, colors: 16},
      SCREEN7: {width: 512, height: 212, colors: 16},
      SCREEN8: {width: 256, height: 212, colors: 256},
      SCREEN10: {width: 256, height: 212, colors: 12499, mode: 'YJK+palette'},
      SCREEN11: {width: 256, height: 212, colors: 12499, mode: 'YJK+palette'},
      SCREEN12: {width: 256, height: 212, colors: 19268, mode: 'YJK'}
    }
  };
})();
