/**
 * NESConsoleMode - NES/Famicom console mode.
 *
 * Provides constraints for NES sprite creation:
 * - 54-color official NES palette
 * - Max 3 colors + transparent per sprite
 * - 8x8 tile size for CHR export
 * - CHR export tab
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * Official NES palette - 54 usable colors.
   * Reference: https://wiki.xxiivv.com/site/chr_format.html
   */
  var NES_PALETTE_DATA = [
    // Row 0 (darks) - $00-$0C, $0F
    {color: '#7C7C7C', register: '$00'},
    {color: '#0000FC', register: '$01'},
    {color: '#0000BC', register: '$02'},
    {color: '#4428BC', register: '$03'},
    {color: '#940084', register: '$04'},
    {color: '#A80020', register: '$05'},
    {color: '#A81000', register: '$06'},
    {color: '#881400', register: '$07'},
    {color: '#503000', register: '$08'},
    {color: '#007800', register: '$09'},
    {color: '#006800', register: '$0A'},
    {color: '#005800', register: '$0B'},
    {color: '#004058', register: '$0C'},
    {color: '#000000', register: '$0F'},
    // Row 1 (mids) - $10-$1C, $1F
    {color: '#BCBCBC', register: '$10'},
    {color: '#0078F8', register: '$11'},
    {color: '#0058F8', register: '$12'},
    {color: '#6844FC', register: '$13'},
    {color: '#D800CC', register: '$14'},
    {color: '#E40058', register: '$15'},
    {color: '#F83800', register: '$16'},
    {color: '#E45C10', register: '$17'},
    {color: '#AC7C00', register: '$18'},
    {color: '#00B800', register: '$19'},
    {color: '#00A800', register: '$1A'},
    {color: '#00A844', register: '$1B'},
    {color: '#008888', register: '$1C'},
    {color: '#000000', register: '$1F'},
    // Row 2 (brights) - $20-$2C, $2D (gray)
    {color: '#F8F8F8', register: '$20'},
    {color: '#3CBCFC', register: '$21'},
    {color: '#6888FC', register: '$22'},
    {color: '#9878F8', register: '$23'},
    {color: '#F878F8', register: '$24'},
    {color: '#F85898', register: '$25'},
    {color: '#F87858', register: '$26'},
    {color: '#FCA044', register: '$27'},
    {color: '#F8B800', register: '$28'},
    {color: '#B8F818', register: '$29'},
    {color: '#58D854', register: '$2A'},
    {color: '#58F898', register: '$2B'},
    {color: '#00E8D8', register: '$2C'},
    {color: '#787878', register: '$2D'},
    // Row 3 (pastels) - $30-$3C, $3D (light pink)
    {color: '#FCFCFC', register: '$30'},
    {color: '#A4E4FC', register: '$31'},
    {color: '#B8B8F8', register: '$32'},
    {color: '#D8B8F8', register: '$33'},
    {color: '#F8B8F8', register: '$34'},
    {color: '#F8A4C0', register: '$35'},
    {color: '#F0D0B0', register: '$36'},
    {color: '#FCE0A8', register: '$37'},
    {color: '#F8D878', register: '$38'},
    {color: '#D8F878', register: '$39'},
    {color: '#B8F8B8', register: '$3A'},
    {color: '#B8F8D8', register: '$3B'},
    {color: '#00FCFC', register: '$3C'},
    {color: '#F8D8F8', register: '$3D'}
  ];

  /** Extract just the color values for the palette array. */
  var NES_PALETTE = NES_PALETTE_DATA.map(function (entry) {
    return entry.color;
  });

  /** Map from hex color to register address. */
  var COLOR_TO_REGISTER = {};
  NES_PALETTE_DATA.forEach(function (entry) {
    COLOR_TO_REGISTER[entry.color.toUpperCase()] = entry.register;
  });

  /**
   * NES-specific console mode extending base ConsoleMode.
   */
  var NESConsoleMode = function () {
    pskl.consoles.ConsoleMode.call(this, {
      id: 'nes',
      name: 'NES / Famicom',
      bodyClass: 'console-nes',
      palette: NES_PALETTE,
      maxColors: 3,        // 3 colors + transparent
      tileSize: 8,         // 8x8 tiles for CHR
      defaultSize: {width: 16, height: 16},  // Common NES sprite size
      exportTabs: ['chr'],
      themeVariables: {
        '--highlight-color': '#E40058',
        '--console-accent': '#E40058',
        '--console-accent-dim': '#a8003f',
        '--console-bg-dark': '#1a1a1e',
        '--console-bg-medium': '#252529',
        '--console-bg-light': '#35353a',
        '--console-border': '#4a4a52',
        '--console-text': '#c8c8c8'
      },
      badgeText: 'NES'
    });

    /** @type {number} Bytes per tile in CHR format. */
    this.BYTES_PER_TILE = 16;
  };

  pskl.utils.inherit(NESConsoleMode, pskl.consoles.ConsoleMode);

  /**
   * Gets extended palette data with register addresses.
   * @return {Array<Object>} Array of {color, register}
   */
  NESConsoleMode.prototype.getPaletteData = function () {
    return NES_PALETTE_DATA;
  };

  /**
   * Gets the PPU register address for a given color.
   * @param {string} hexColor - Hex color string (e.g., '#000000')
   * @return {string|null} Register address or null if not found
   */
  NESConsoleMode.prototype.getRegisterForColor = function (hexColor) {
    return COLOR_TO_REGISTER[hexColor.toUpperCase()] || null;
  };

  /**
   * Creates and returns a new NES console mode instance.
   * @return {NESConsoleMode}
   */
  ns.createNESMode = function () {
    return new NESConsoleMode();
  };

  // Export constants for backward compatibility with existing code
  ns.NESConstants = {
    PALETTE: NES_PALETTE,
    PALETTE_DATA: NES_PALETTE_DATA,
    COLOR_TO_REGISTER: COLOR_TO_REGISTER,
    MAX_SPRITE_COLORS: 3,
    TILE_SIZE: 8,
    BYTES_PER_TILE: 16
  };
})();
