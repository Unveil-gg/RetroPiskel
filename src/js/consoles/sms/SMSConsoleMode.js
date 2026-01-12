/**
 * SMSConsoleMode - Sega Master System console mode.
 *
 * Provides constraints for SMS sprite creation:
 * - Fixed 64-color palette (RGB222: 2 bits per channel)
 * - Max 15 colors + transparent per sprite
 * - 8x8 tile size for 4BPP export
 * - 4BPP export tab with CRAM palette file
 *
 * SMS uses 6-bit color (RGB222) stored in CRAM format:
 *   --BBGGRR (1 byte per color, 2 bits per channel)
 *
 * Unlike Genesis (RGB333 = 512 colors), SMS has only 64 colors,
 * making a fixed palette grid practical and user-friendly.
 *
 * References:
 * - https://www.smspower.org/Development/Palette
 * - https://www.smspower.org/Development/Sprites
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * SMS 64-color palette data.
   * RGB222 format: 2 bits per channel = 4 levels (0, 85, 170, 255).
   * Organized by intensity for intuitive color selection.
   */
  var SMS_PALETTE_DATA = [
    // Row 0: Grayscale and near-blacks
    {color: '#000000', cram: 0x00},  // Black
    {color: '#550000', cram: 0x01},  // Dark red
    {color: '#005500', cram: 0x04},  // Dark green
    {color: '#000055', cram: 0x10},  // Dark blue
    {color: '#555500', cram: 0x05},  // Dark yellow
    {color: '#550055', cram: 0x11},  // Dark magenta
    {color: '#005555', cram: 0x14},  // Dark cyan
    {color: '#555555', cram: 0x15},  // Dark gray

    // Row 1: Medium-dark colors
    {color: '#AA0000', cram: 0x02},  // Medium red
    {color: '#00AA00', cram: 0x08},  // Medium green
    {color: '#0000AA', cram: 0x20},  // Medium blue
    {color: '#AAAA00', cram: 0x0A},  // Medium yellow
    {color: '#AA00AA', cram: 0x22},  // Medium magenta
    {color: '#00AAAA', cram: 0x28},  // Medium cyan
    {color: '#AA5500', cram: 0x06},  // Brown/orange
    {color: '#55AA00', cram: 0x09},  // Yellow-green

    // Row 2: Medium colors with mixes
    {color: '#0055AA', cram: 0x24},  // Sky blue
    {color: '#5500AA', cram: 0x21},  // Purple
    {color: '#AA0055', cram: 0x12},  // Rose
    {color: '#00AA55', cram: 0x18},  // Sea green
    {color: '#55AA55', cram: 0x19},  // Medium olive
    {color: '#AA55AA', cram: 0x26},  // Orchid
    {color: '#55AAAA', cram: 0x29},  // Teal
    {color: '#AAAAAA', cram: 0x2A},  // Medium gray

    // Row 3: Bright primary colors
    {color: '#FF0000', cram: 0x03},  // Bright red
    {color: '#00FF00', cram: 0x0C},  // Bright green
    {color: '#0000FF', cram: 0x30},  // Bright blue
    {color: '#FFFF00', cram: 0x0F},  // Bright yellow
    {color: '#FF00FF', cram: 0x33},  // Bright magenta
    {color: '#00FFFF', cram: 0x3C},  // Bright cyan
    {color: '#FF5500', cram: 0x07},  // Orange
    {color: '#55FF00', cram: 0x0D},  // Lime

    // Row 4: Bright mixes
    {color: '#0055FF', cram: 0x34},  // Azure
    {color: '#5500FF', cram: 0x31},  // Violet
    {color: '#FF0055', cram: 0x13},  // Hot pink
    {color: '#00FF55', cram: 0x1C},  // Spring green
    {color: '#FF5555', cram: 0x17},  // Salmon
    {color: '#55FF55', cram: 0x1D},  // Light green
    {color: '#5555FF', cram: 0x35},  // Cornflower
    {color: '#FFAA00', cram: 0x0B},  // Gold

    // Row 5: Light/pastel colors
    {color: '#FFAA55', cram: 0x1B},  // Peach
    {color: '#55FFAA', cram: 0x2D},  // Aquamarine
    {color: '#AA55FF', cram: 0x36},  // Light purple
    {color: '#AAFF55', cram: 0x1E},  // Yellow-lime
    {color: '#55AAFF', cram: 0x39},  // Light sky blue
    {color: '#FF55AA', cram: 0x27},  // Pink
    {color: '#AAFFAA', cram: 0x2E},  // Pale green
    {color: '#FFAAAA', cram: 0x2B},  // Light coral

    // Row 6: More pastels and light colors
    {color: '#AAAAFF', cram: 0x3A},  // Lavender
    {color: '#FFAAFF', cram: 0x3B},  // Light pink
    {color: '#AAFFFF', cram: 0x3E},  // Pale cyan
    {color: '#FFFFAA', cram: 0x2F},  // Pale yellow
    {color: '#00AAFF', cram: 0x38},  // Deep sky blue
    {color: '#AA00FF', cram: 0x32},  // Electric purple
    {color: '#FF00AA', cram: 0x23},  // Deep pink
    {color: '#AAFF00', cram: 0x0E},  // Chartreuse

    // Row 7: Remaining colors and white
    {color: '#FFFF55', cram: 0x1F},  // Light yellow
    {color: '#FF55FF', cram: 0x37},  // Fuchsia
    {color: '#55FFFF', cram: 0x3D},  // Light cyan
    {color: '#AAAA55', cram: 0x1A},  // Khaki
    {color: '#5555AA', cram: 0x25},  // Slate blue
    {color: '#00FFAA', cram: 0x2C},  // Medium spring green
    {color: '#AA5555', cram: 0x16},  // Dusty rose
    {color: '#FFFFFF', cram: 0x3F}   // White
  ];

  /** Extract just the color values for the palette array. */
  var SMS_PALETTE = SMS_PALETTE_DATA.map(function (entry) {
    return entry.color;
  });

  /** Map from hex color to CRAM byte value. */
  var COLOR_TO_CRAM = {};
  SMS_PALETTE_DATA.forEach(function (entry) {
    COLOR_TO_CRAM[entry.color.toUpperCase()] = entry.cram;
  });

  /**
   * SMS-specific console mode extending base ConsoleMode.
   */
  var SMSConsoleMode = function () {
    pskl.consoles.ConsoleMode.call(this, {
      id: 'sms',
      name: 'Sega Master System',
      bodyClass: 'console-sms',
      palette: SMS_PALETTE,
      maxColors: 15,        // 15 colors + transparent (4bpp = 16 total)
      tileSize: 8,          // 8x8 tiles for 4BPP
      defaultSize: {width: 8, height: 16},  // Common SMS sprite (8x16)
      exportTabs: ['sms4bpp'],
      themeVariables: {
        '--highlight-color': '#CC0000',
        '--console-accent': '#CC0000',
        '--console-accent-text': '#FF6666',
        '--console-accent-dim': '#990000',
        '--console-bg-dark': '#0a0a0a',
        '--console-bg-medium': '#141418',
        '--console-bg-light': '#1e1e24',
        '--console-border': '#3a3a48',
        '--console-text': '#d8d8e0'
      },
      badgeText: 'SMS'
    });

    /** @type {number} Bytes per tile in 4BPP format. */
    this.BYTES_PER_TILE = 32;
  };

  pskl.utils.inherit(SMSConsoleMode, pskl.consoles.ConsoleMode);

  /**
   * Gets extended palette data with CRAM values.
   * @return {Array<Object>} Array of {color, cram}
   */
  SMSConsoleMode.prototype.getPaletteData = function () {
    return SMS_PALETTE_DATA;
  };

  /**
   * Gets the CRAM byte value for a given color.
   * @param {string} hexColor - Hex color string (e.g., '#FF0000')
   * @return {number|null} CRAM byte value (0-63) or null if not found
   */
  SMSConsoleMode.prototype.getCRAMForColor = function (hexColor) {
    var cram = COLOR_TO_CRAM[hexColor.toUpperCase()];
    return cram !== undefined ? cram : null;
  };

  /**
   * Converts a hex color to SMS CRAM format (1 byte).
   * Format: --BBGGRR (2 bits per channel)
   * @param {string} hexColor - Hex color string
   * @return {number} CRAM byte value (0-63)
   */
  SMSConsoleMode.prototype.colorToCRAMByte = function (hexColor) {
    // First check if it's a known palette color
    var knownCram = this.getCRAMForColor(hexColor);
    if (knownCram !== null) {
      return knownCram;
    }

    // Fallback: convert any color to nearest SMS color
    var tc = window.tinycolor(hexColor);
    var rgb = tc.toRgb();

    var r2 = Math.round(rgb.r * 3 / 255);
    var g2 = Math.round(rgb.g * 3 / 255);
    var b2 = Math.round(rgb.b * 3 / 255);

    // SMS CRAM format: --BBGGRR
    return (b2 << 4) | (g2 << 2) | r2;
  };

  /**
   * Creates and returns a new SMS console mode instance.
   * @return {SMSConsoleMode}
   */
  ns.createSMSMode = function () {
    return new SMSConsoleMode();
  };

  // Export constants for use by exporters and other code
  ns.SMSConstants = {
    PALETTE: SMS_PALETTE,
    PALETTE_DATA: SMS_PALETTE_DATA,
    COLOR_TO_CRAM: COLOR_TO_CRAM,
    MAX_SPRITE_COLORS: 15,    // 15 + transparent = 16 (4bpp)
    TILE_SIZE: 8,
    BYTES_PER_TILE: 32,       // 4bpp = 32 bytes per 8x8 tile
    BYTES_PER_PALETTE: 16,    // 16 colors × 1 byte each
    COLOR_DEPTH: 2,           // 2 bits per RGB channel
    BITS_PER_PIXEL: 4,        // 4bpp tile format
    TOTAL_COLORS: 64          // 4 × 4 × 4 = 64 possible colors
  };
})();
