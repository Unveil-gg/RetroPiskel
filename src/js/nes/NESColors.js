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
     * Row 0: Dark colors
     * Row 1: Medium colors
     * Row 2: Bright colors
     * Row 3: Pastel colors
     */
    PALETTE: [
      // Row 0 (darks)
      '#7C7C7C', '#0000FC', '#0000BC', '#4428BC',
      '#940084', '#A80020', '#A81000', '#881400',
      '#503000', '#007800', '#006800', '#005800',
      '#004058', '#000000',
      // Row 1 (mids)
      '#BCBCBC', '#0078F8', '#0058F8', '#6844FC',
      '#D800CC', '#E40058', '#F83800', '#E45C10',
      '#AC7C00', '#00B800', '#00A800', '#00A844',
      '#008888', '#000000',
      // Row 2 (brights)
      '#F8F8F8', '#3CBCFC', '#6888FC', '#9878F8',
      '#F878F8', '#F85898', '#F87858', '#FCA044',
      '#F8B800', '#B8F818', '#58D854', '#58F898',
      '#00E8D8', '#787878',
      // Row 3 (pastels)
      '#FCFCFC', '#A4E4FC', '#B8B8F8', '#D8B8F8',
      '#F8B8F8', '#F8A4C0', '#F0D0B0', '#FCE0A8',
      '#F8D878', '#D8F878', '#B8F8B8', '#B8F8D8',
      '#00FCFC', '#F8D8F8'
    ],

    /**
     * Max non-transparent colors allowed in a sprite.
     * NES sprites use 4 colors total (indices 0-3), where 0 is transparent.
     */
    MAX_SPRITE_COLORS: 3,

    /** Tile dimensions in pixels. */
    TILE_SIZE: 8,

    /** Bytes per tile in CHR format (8 bytes ch1 + 8 bytes ch2). */
    BYTES_PER_TILE: 16
  };
})();

