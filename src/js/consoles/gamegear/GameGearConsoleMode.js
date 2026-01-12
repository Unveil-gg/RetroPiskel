/**
 * GameGearConsoleMode - Sega Game Gear console mode.
 *
 * Provides constraints for Game Gear sprite creation:
 * - 4096-color palette (RGB444: 4 bits per channel)
 * - Max 15 colors + transparent per sprite
 * - 8x8 tile size for 4BPP export
 * - 4BPP export tab with GG CRAM palette file (12-bit)
 *
 * Game Gear uses 12-bit color (RGB444) stored in CRAM format:
 *   Byte 0: GGGGRRRR (low byte)
 *   Byte 1: ----BBBB (high byte)
 *   Little-endian, 2 bytes per color
 *
 * Unlike SMS (RGB222 = 64 colors), Game Gear has 4096 colors,
 * so we use a free color picker with quantization on export.
 *
 * References:
 * - https://www.smspower.org/Development/Palette
 * - https://segaretro.org/Sega_Game_Gear
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * Game Gear-specific console mode extending base ConsoleMode.
   */
  var GameGearConsoleMode = function () {
    pskl.consoles.ConsoleMode.call(this, {
      id: 'gamegear',
      name: 'Sega Game Gear',
      bodyClass: 'console-gamegear',
      palette: null,            // Free color picker (4096 colors)
      paletteType: 'rgb444',    // 12-bit RGB for color quantization
      maxColors: 15,            // 15 colors + transparent (4bpp = 16 total)
      tileSize: 8,              // 8x8 tiles for 4BPP
      defaultSize: {width: 8, height: 16},  // Common GG sprite (8x16)
      exportTabs: ['gg4bpp'],
      themeVariables: {
        '--highlight-color': '#00A8A8',
        '--console-accent': '#00A8A8',
        '--console-accent-text': '#5CDEDE',
        '--console-accent-dim': '#007878',
        '--console-bg-dark': '#08090a',
        '--console-bg-medium': '#101214',
        '--console-bg-light': '#181a1e',
        '--console-border': '#2a4048',
        '--console-text': '#d4dce0'
      },
      badgeText: 'GG'
    });

    /** @type {number} Bytes per tile in 4BPP format. */
    this.BYTES_PER_TILE = 32;

    /** @type {number} Bytes per color in GG CRAM (2 bytes). */
    this.BYTES_PER_COLOR = 2;
  };

  pskl.utils.inherit(GameGearConsoleMode, pskl.consoles.ConsoleMode);

  /**
   * Converts a hex color to Game Gear CRAM format (2 bytes).
   * Format: Little-endian RGB444
   *   Byte 0: GGGGRRRR
   *   Byte 1: ----BBBB
   *
   * @param {string} hexColor - Hex color string
   * @return {Array<number>} [lowByte, highByte] CRAM values
   */
  GameGearConsoleMode.prototype.colorToCRAMBytes = function (hexColor) {
    var tc = window.tinycolor(hexColor);
    var rgb = tc.toRgb();

    // Quantize to 4 bits per channel (0-15)
    var r4 = Math.round(rgb.r * 15 / 255);
    var g4 = Math.round(rgb.g * 15 / 255);
    var b4 = Math.round(rgb.b * 15 / 255);

    // GG CRAM format (little-endian):
    // Byte 0: GGGGRRRR
    // Byte 1: ----BBBB
    var lowByte = (g4 << 4) | r4;
    var highByte = b4;

    return [lowByte, highByte];
  };

  /**
   * Converts a Game Gear CRAM value to hex color.
   *
   * @param {number} lowByte - Low byte (GGGGRRRR)
   * @param {number} highByte - High byte (----BBBB)
   * @return {string} Hex color string
   */
  GameGearConsoleMode.prototype.cramToColor = function (lowByte, highByte) {
    var r4 = lowByte & 0x0F;
    var g4 = (lowByte >> 4) & 0x0F;
    var b4 = highByte & 0x0F;

    // Expand 4-bit to 8-bit (0-15 -> 0-255)
    var r8 = Math.round(r4 * 255 / 15);
    var g8 = Math.round(g4 * 255 / 15);
    var b8 = Math.round(b4 * 255 / 15);

    return '#' +
      r8.toString(16).padStart(2, '0') +
      g8.toString(16).padStart(2, '0') +
      b8.toString(16).padStart(2, '0');
  };

  /**
   * Quantizes any color to the nearest RGB444 value.
   *
   * @param {string} hexColor - Any hex color
   * @return {string} Quantized hex color (one of 4096 values)
   */
  GameGearConsoleMode.prototype.quantizeColor = function (hexColor) {
    var cramBytes = this.colorToCRAMBytes(hexColor);
    return this.cramToColor(cramBytes[0], cramBytes[1]);
  };

  /**
   * Creates and returns a new Game Gear console mode instance.
   * @return {GameGearConsoleMode}
   */
  ns.createGameGearMode = function () {
    return new GameGearConsoleMode();
  };

  // Export constants for use by exporters and other code
  ns.GameGearConstants = {
    MAX_SPRITE_COLORS: 15,      // 15 + transparent = 16 (4bpp)
    TILE_SIZE: 8,
    BYTES_PER_TILE: 32,         // 4bpp = 32 bytes per 8x8 tile
    BYTES_PER_COLOR: 2,         // 2 bytes per CRAM entry (RGB444)
    BYTES_PER_PALETTE: 32,      // 16 colors × 2 bytes each
    COLOR_DEPTH: 4,             // 4 bits per RGB channel
    BITS_PER_PIXEL: 4,          // 4bpp tile format
    TOTAL_COLORS: 4096          // 16 × 16 × 16 = 4096 possible colors
  };
})();
