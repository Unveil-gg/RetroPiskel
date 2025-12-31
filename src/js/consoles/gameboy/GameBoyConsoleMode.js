/**
 * GameBoyConsoleMode - Original Game Boy (DMG) console mode.
 *
 * Provides constraints for Game Boy sprite creation:
 * - 4-shade green-tint palette (classic DMG LCD appearance)
 * - Max 3 colors + transparent per sprite
 * - 8x8 tile size for 2BPP export
 * - 2BPP export tab
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * Classic Game Boy DMG palette - 4 shades of green.
   * These hex values approximate the original LCD screen appearance.
   */
  var GB_PALETTE_DATA = [
    {color: '#9BBC0F', shade: 0, name: 'Lightest'},  // Near white
    {color: '#8BAC0F', shade: 1, name: 'Light'},     // Light green
    {color: '#306230', shade: 2, name: 'Dark'},      // Dark green
    {color: '#0F380F', shade: 3, name: 'Darkest'}    // Near black
  ];

  /** Extract just the color values for the palette array. */
  var GB_PALETTE = GB_PALETTE_DATA.map(function (entry) {
    return entry.color;
  });

  /** Map from hex color to shade index (0-3). */
  var COLOR_TO_SHADE = {};
  GB_PALETTE_DATA.forEach(function (entry) {
    COLOR_TO_SHADE[entry.color.toUpperCase()] = entry.shade;
  });

  /**
   * Game Boy-specific console mode extending base ConsoleMode.
   */
  var GameBoyConsoleMode = function () {
    pskl.consoles.ConsoleMode.call(this, {
      id: 'gameboy',
      name: 'Game Boy (DMG)',
      bodyClass: 'console-gameboy',
      palette: GB_PALETTE,
      maxColors: 3,               // 3 colors + transparent
      tileSize: 8,                // 8x8 tiles for 2BPP
      defaultSize: {width: 8, height: 16},  // Common GB sprite size
      exportTabs: ['gb2bpp'],
      themeVariables: {
        '--highlight-color': '#8B1C62',
        '--console-accent': '#8B1C62',
        '--console-accent-dim': '#5C1341',
        '--console-bg-dark': '#2A2A28',
        '--console-bg-medium': '#3D3D38',
        '--console-bg-light': '#4A4A44',
        '--console-border': '#5A5A52',
        '--console-text': '#C4C4A4'
      },
      badgeText: 'GB'
    });

    /** @type {number} Bytes per tile in 2BPP format. */
    this.BYTES_PER_TILE = 16;
  };

  pskl.utils.inherit(GameBoyConsoleMode, pskl.consoles.ConsoleMode);

  /**
   * Gets extended palette data with shade indices.
   * @return {Array<Object>} Array of {color, shade, name}
   */
  GameBoyConsoleMode.prototype.getPaletteData = function () {
    return GB_PALETTE_DATA;
  };

  /**
   * Gets the shade index (0-3) for a given color.
   * @param {string} hexColor - Hex color string (e.g., '#9BBC0F')
   * @return {number|null} Shade index 0-3 or null if not found
   */
  GameBoyConsoleMode.prototype.getShadeForColor = function (hexColor) {
    var shade = COLOR_TO_SHADE[hexColor.toUpperCase()];
    return shade !== undefined ? shade : null;
  };

  /**
   * Creates and returns a new Game Boy console mode instance.
   * @return {GameBoyConsoleMode}
   */
  ns.createGameBoyMode = function () {
    return new GameBoyConsoleMode();
  };

  // Export constants for use by exporters and other code
  ns.GameBoyConstants = {
    PALETTE: GB_PALETTE,
    PALETTE_DATA: GB_PALETTE_DATA,
    COLOR_TO_SHADE: COLOR_TO_SHADE,
    MAX_SPRITE_COLORS: 3,
    TILE_SIZE: 8,
    BYTES_PER_TILE: 16
  };
})();

