/**
 * GenesisConsoleMode - Sega Genesis / Mega Drive console mode.
 *
 * Provides constraints for Genesis sprite creation:
 * - RGB333 color space (512 colors, 3 bits per channel)
 * - Max 15 colors + transparent per sprite (4bpp = 16 palette entries)
 * - 8x8 tile size for 4BPP export
 * - 4BPP export tab with palette file
 *
 * Genesis uses 9-bit color (RGB333) stored in CRAM format:
 *   0000BBB0 GGG0RRR0 (each channel in bits 1-3)
 *
 * References:
 * - https://segaretro.org/Sega_Mega_Drive/VDP
 * - https://wiki.megadrive.org/
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * Genesis-specific console mode extending base ConsoleMode.
   */
  var GenesisConsoleMode = function () {
    pskl.consoles.ConsoleMode.call(this, {
      id: 'genesis',
      name: 'Sega Genesis / Mega Drive',
      bodyClass: 'console-genesis',
      palette: null,          // No fixed palette - uses RGB333 picker
      paletteType: 'rgb333',  // Signals 9-bit color picker mode
      maxColors: 15,          // 15 colors + transparent (4bpp = 16 total)
      tileSize: 8,            // 8x8 tiles for 4BPP
      defaultSize: {width: 16, height: 16},  // Common Genesis sprite size
      exportTabs: ['genesis4bpp'],
      themeVariables: {
        '--highlight-color': '#0066CC',
        '--console-accent': '#0066CC',
        '--console-accent-text': '#66B3FF',
        '--console-accent-dim': '#004C99',
        '--console-bg-dark': '#0a0a12',
        '--console-bg-medium': '#12121e',
        '--console-bg-light': '#1e1e2e',
        '--console-border': '#2a4080',
        '--console-text': '#e0e0e8'
      },
      badgeText: 'GEN'
    });

    /** @type {number} Bytes per tile in 4BPP format. */
    this.BYTES_PER_TILE = 32;
  };

  pskl.utils.inherit(GenesisConsoleMode, pskl.consoles.ConsoleMode);

  /**
   * Snaps an 8-bit RGB value (0-255) to nearest Genesis 3-bit value.
   * Genesis uses 3 bits per channel = 8 levels (0-7).
   * @param {number} value8bit - RGB component value 0-255
   * @return {number} Snapped 8-bit value (one of 8 valid Genesis values)
   */
  GenesisConsoleMode.prototype.snapTo3Bit = function (value8bit) {
    // Convert 8-bit (0-255) to 3-bit (0-7) and back
    var value3bit = Math.round(value8bit * 7 / 255);
    return Math.round(value3bit * 255 / 7);
  };

  /**
   * Gets the 3-bit Genesis value (0-7) from an 8-bit value.
   * @param {number} value8bit - RGB component value 0-255
   * @return {number} Genesis 3-bit value 0-7
   */
  GenesisConsoleMode.prototype.to3Bit = function (value8bit) {
    return Math.round(value8bit * 7 / 255);
  };

  /**
   * Snaps a hex color to the nearest valid Genesis RGB333 color.
   * @param {string} hexColor - Hex color string (e.g., '#FF8040')
   * @return {string} Snapped hex color string
   */
  GenesisConsoleMode.prototype.snapColorToRGB333 = function (hexColor) {
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
   * Converts a hex color to Genesis CRAM format (2 bytes).
   * Format: 0000BBB0 GGG0RRR0 (each channel shifted left by 1)
   * @param {string} hexColor - Hex color string
   * @return {Uint8Array} 2-byte array in Genesis CRAM format
   */
  GenesisConsoleMode.prototype.colorToCRAMBytes = function (hexColor) {
    var tc = window.tinycolor(hexColor);
    var rgb = tc.toRgb();

    var r3 = this.to3Bit(rgb.r);
    var g3 = this.to3Bit(rgb.g);
    var b3 = this.to3Bit(rgb.b);

    // Genesis CRAM format: 0000BBB0 GGG0RRR0
    // Low byte:  0000BBB0 (B shifted left by 1)
    // High byte: GGG0RRR0 (G in bits 5-7, R in bits 1-3)
    // Actually stored as: ----BBB- GGG-RRR- in big-endian (Motorola 68000)
    // But we output little-endian for consistency with file formats
    var byte0 = (r3 << 1) | (g3 << 5);  // GGG0RRR0
    var byte1 = (b3 << 1);               // 0000BBB0

    return new Uint8Array([byte0, byte1]);
  };

  /**
   * Gets palette data with RGB333 values for export.
   * @return {Array<Object>|null} Array of {color, rgb333} or null
   */
  GenesisConsoleMode.prototype.getPaletteData = function () {
    return null;  // No fixed palette - colors come from sprite
  };

  /**
   * Override: Genesis validates colors by snapping, not rejecting.
   * Any color is valid after snapping to RGB333.
   * @param {string} color - Hex color string
   * @return {boolean} Always true (all colors snap to valid)
   */
  GenesisConsoleMode.prototype.isValidColor = function (color) {
    return true;
  };

  /**
   * Creates and returns a new Genesis console mode instance.
   * @return {GenesisConsoleMode}
   */
  ns.createGenesisMode = function () {
    return new GenesisConsoleMode();
  };

  // Export constants for use by exporters and other code
  ns.GenesisConstants = {
    MAX_SPRITE_COLORS: 15,    // 15 + transparent = 16 (4bpp)
    TILE_SIZE: 8,
    BYTES_PER_TILE: 32,       // 4bpp = 32 bytes per 8x8 tile
    BYTES_PER_PALETTE: 32,    // 16 colors × 2 bytes each
    COLOR_DEPTH: 3,           // 3 bits per RGB channel
    BITS_PER_PIXEL: 4,        // 4bpp tile format
    TOTAL_COLORS: 512         // 8 × 8 × 8 = 512 possible colors
  };
})();
