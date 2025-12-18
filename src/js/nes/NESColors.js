/**
 * NES color palette constants.
 * Reference: https://wiki.xxiivv.com/site/chr_format.html
 *
 * The NES has a fixed palette of 54 usable colors. Sprites can use
 * up to 4 colors (indices 0-3), where index 0 is always transparent.
 */
(function () {
  var ns = $.namespace('pskl.nes');

  ns.NESColors = {
    /**
     * Official NES palette - 54 usable colors organized in 4 rows.
     * Each entry contains {color: hex, register: PPU address}.
     * Row 0: Dark colors ($00-$0F)
     * Row 1: Medium colors ($10-$1F)
     * Row 2: Bright colors ($20-$2F)
     * Row 3: Pastel colors ($30-$3F)
     */
    PALETTE_DATA: [
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
    ],

    /**
     * Simple array of hex colors for backward compatibility.
     * @return {Array} Array of hex color strings
     */
    PALETTE: null,  // Initialized below

    /**
     * Map from hex color to register address.
     * @return {Object} Color to register mapping
     */
    COLOR_TO_REGISTER: null,  // Initialized below

    /**
     * Max non-transparent colors allowed in a sprite.
     * NES sprites use 4 colors total (indices 0-3), where 0 is transparent.
     */
    MAX_SPRITE_COLORS: 3,

    /** Tile dimensions in pixels. */
    TILE_SIZE: 8,

    /** Bytes per tile in CHR format (8 bytes ch1 + 8 bytes ch2). */
    BYTES_PER_TILE: 16,

    /**
     * Gets the PPU register address for a given color.
     * @param {string} hexColor - Hex color string (e.g., '#000000')
     * @return {string|null} Register address or null if not found
     */
    getRegister: function (hexColor) {
      var upper = hexColor.toUpperCase();
      return this.COLOR_TO_REGISTER[upper] || null;
    }
  };

  // Initialize PALETTE array and COLOR_TO_REGISTER map from PALETTE_DATA
  (function () {
    var data = ns.NESColors.PALETTE_DATA;
    var palette = [];
    var colorToReg = {};

    for (var i = 0; i < data.length; i++) {
      var entry = data[i];
      palette.push(entry.color);
      // Map color to register (handle duplicate blacks by keeping both)
      var upperColor = entry.color.toUpperCase();
      if (!colorToReg[upperColor]) {
        colorToReg[upperColor] = entry.register;
      } else {
        // For duplicates like black, append both registers
        colorToReg[upperColor] += ' / ' + entry.register;
      }
    }

    ns.NESColors.PALETTE = palette;
    ns.NESColors.COLOR_TO_REGISTER = colorToReg;
  })();
})();

