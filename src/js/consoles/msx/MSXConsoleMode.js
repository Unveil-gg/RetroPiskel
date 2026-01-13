/**
 * MSXConsoleMode - MSX1 (TMS9918A) console mode.
 *
 * Theme: "Konami Golden Era" - Gold accents inspired by Konami's
 * legendary MSX library (Gradius, Castlevania, Penguin Adventure).
 *
 * Provides constraints for MSX1 sprite creation:
 * - Fixed 16-color TMS9918A palette (not programmable)
 * - Max 1 color + transparent per sprite (monochrome sprites)
 * - 8x8 or 16x16 sprite sizes
 * - Pattern table export (1BPP + color table)
 *
 * MSX1 uses the TMS9918A VDP which has a fixed palette of 15 colors
 * plus transparent. Sprites are monochrome (single color).
 *
 * References:
 * - https://www.msx.org/wiki/Category:VDP
 * - https://www.smspower.org/Development/Palette (TMS9918 origin)
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * TMS9918A fixed 16-color palette.
   * These colors cannot be changed - they are hardwired into the VDP.
   * Color 0 is transparent in sprite mode.
   */
  var MSX_PALETTE_DATA = [
    {color: '#000000', index: 1,  name: 'Black'},
    {color: '#21C842', index: 2,  name: 'Medium Green'},
    {color: '#5EDC78', index: 3,  name: 'Light Green'},
    {color: '#5455ED', index: 4,  name: 'Dark Blue'},
    {color: '#7D76FC', index: 5,  name: 'Light Blue'},
    {color: '#D4524D', index: 6,  name: 'Dark Red'},
    {color: '#42EBF5', index: 7,  name: 'Cyan'},
    {color: '#FC5554', index: 8,  name: 'Medium Red'},
    {color: '#FF7978', index: 9,  name: 'Light Red'},
    {color: '#D4C154', index: 10, name: 'Dark Yellow'},
    {color: '#E6CE80', index: 11, name: 'Light Yellow'},
    {color: '#21B03B', index: 12, name: 'Dark Green'},
    {color: '#C95BBA', index: 13, name: 'Magenta'},
    {color: '#CCCCCC', index: 14, name: 'Gray'},
    {color: '#FFFFFF', index: 15, name: 'White'}
  ];

  /** Extract just the color values for the palette array. */
  var MSX_PALETTE = MSX_PALETTE_DATA.map(function (entry) {
    return entry.color;
  });

  /** Map from hex color to VDP color index. */
  var COLOR_TO_INDEX = {};
  MSX_PALETTE_DATA.forEach(function (entry) {
    COLOR_TO_INDEX[entry.color.toUpperCase()] = entry.index;
  });

  /**
   * MSX1-specific console mode extending base ConsoleMode.
   */
  var MSXConsoleMode = function () {
    pskl.consoles.ConsoleMode.call(this, {
      id: 'msx',
      name: 'MSX (TMS9918)',
      bodyClass: 'console-msx',
      palette: MSX_PALETTE,
      maxColors: 1,               // Monochrome sprites (1 color + transparent)
      tileSize: 8,                // 8x8 tiles
      defaultSize: {width: 16, height: 16},  // Common MSX sprite (16x16)
      exportTabs: ['msx1bpp'],
      themeVariables: {
        '--highlight-color': '#D4A820',
        '--console-accent': '#D4A820',
        '--console-accent-text': '#FFD860',
        '--console-accent-dim': '#9A7810',
        '--console-bg-dark': '#0A0A14',
        '--console-bg-medium': '#12121E',
        '--console-bg-light': '#1E1E2C',
        '--console-border': '#3A3A58',
        '--console-text': '#E8E0D0'
      },
      badgeText: 'MSX'
    });

    /** @type {number} Bytes per 8x8 tile in 1BPP pattern format. */
    this.BYTES_PER_TILE = 8;
  };

  pskl.utils.inherit(MSXConsoleMode, pskl.consoles.ConsoleMode);

  /**
   * Gets extended palette data with VDP color indices.
   * @return {Array<Object>} Array of {color, index, name}
   */
  MSXConsoleMode.prototype.getPaletteData = function () {
    return MSX_PALETTE_DATA;
  };

  /**
   * Gets the VDP color index (1-15) for a given color.
   * @param {string} hexColor - Hex color string (e.g., '#FC5554')
   * @return {number|null} VDP color index or null if not found
   */
  MSXConsoleMode.prototype.getIndexForColor = function (hexColor) {
    var index = COLOR_TO_INDEX[hexColor.toUpperCase()];
    return index !== undefined ? index : null;
  };

  /**
   * Creates and returns a new MSX console mode instance.
   * @return {MSXConsoleMode}
   */
  ns.createMSXMode = function () {
    return new MSXConsoleMode();
  };

  // Export constants for use by exporters and other code
  ns.MSXConstants = {
    PALETTE: MSX_PALETTE,
    PALETTE_DATA: MSX_PALETTE_DATA,
    COLOR_TO_INDEX: COLOR_TO_INDEX,
    MAX_SPRITE_COLORS: 1,         // Monochrome sprites
    TILE_SIZE: 8,
    BYTES_PER_TILE: 8,            // 1BPP = 8 bytes per 8x8 tile
    TOTAL_COLORS: 15,             // 15 usable colors (index 0 = transparent)
    SPRITE_SIZES: [8, 16]         // 8x8 or 16x16 sprites supported
  };
})();
