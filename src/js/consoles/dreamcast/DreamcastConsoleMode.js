/**
 * DreamcastConsoleMode - Sega Dreamcast console mode.
 *
 * Provides constraints for Dreamcast sprite/texture creation:
 * - 16-bit color formats: ARGB1555, RGB565, ARGB4444
 * - Power-of-2 texture dimensions required
 * - PVR export with twiddling for direct KallistiOS use
 * - Raw 16-bit export for custom pipelines
 *
 * Dreamcast uses PowerVR2 GPU with these texture formats:
 *   ARGB1555: 1-bit alpha + 5/5/5 RGB (sharp transparency)
 *   RGB565:   5/6/5 RGB (no alpha, opaque textures)
 *   ARGB4444: 4-bit alpha + 4/4/4 RGB (smooth alpha)
 *
 * References:
 * - https://segaretro.org/images/7/78/DreamcastDevBoxSystemArchitecture.pdf
 * - https://dreamcast.wiki/Twiddling
 * - https://github.com/KallistiOS/KallistiOS
 */
(function () {
  var ns = $.namespace('pskl.consoles');

  /**
   * Dreamcast-specific console mode extending base ConsoleMode.
   */
  var DreamcastConsoleMode = function () {
    pskl.consoles.ConsoleMode.call(this, {
      id: 'dreamcast',
      name: 'Sega Dreamcast',
      bodyClass: 'console-dreamcast',
      palette: null,            // Free color picker (16-bit color)
      paletteType: 'rgb565',    // Default to RGB565 for color snapping
      maxColors: null,          // No strict color limit (16-bit direct color)
      tileSize: null,           // No tile requirement, but power-of-2 dims
      defaultSize: {width: 32, height: 32},
      exportTabs: ['dreamcastpvr'],
      themeVariables: {
        '--highlight-color': '#FF6600',
        '--console-accent': '#FF6600',
        '--console-accent-text': '#FF9944',
        '--console-accent-dim': '#CC5200',
        '--console-bg-dark': '#0a0808',
        '--console-bg-medium': '#141210',
        '--console-bg-light': '#1e1a18',
        '--console-border': '#4a3830',
        '--console-text': '#e8e0d8'
      },
      badgeText: 'DC'
    });

    /** @type {number} Bytes per pixel for 16-bit formats. */
    this.BYTES_PER_PIXEL = 2;
  };

  pskl.utils.inherit(DreamcastConsoleMode, pskl.consoles.ConsoleMode);

  // =========================================================================
  // Color Conversion Methods
  // =========================================================================

  /**
   * Converts RGBA to ARGB1555 format.
   * Format: A RRRRR GGGGG BBBBB (1-5-5-5)
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @param {number} a - Alpha (0-255)
   * @return {number} 16-bit ARGB1555 value
   */
  DreamcastConsoleMode.prototype.toARGB1555 = function (r, g, b, a) {
    var alpha = (a >= 128) ? 1 : 0;
    var r5 = Math.round(r * 31 / 255);
    var g5 = Math.round(g * 31 / 255);
    var b5 = Math.round(b * 31 / 255);
    return (alpha << 15) | (r5 << 10) | (g5 << 5) | b5;
  };

  /**
   * Converts RGB to RGB565 format.
   * Format: RRRRR GGGGGG BBBBB (5-6-5)
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @return {number} 16-bit RGB565 value
   */
  DreamcastConsoleMode.prototype.toRGB565 = function (r, g, b) {
    var r5 = Math.round(r * 31 / 255);
    var g6 = Math.round(g * 63 / 255);
    var b5 = Math.round(b * 31 / 255);
    return (r5 << 11) | (g6 << 5) | b5;
  };

  /**
   * Converts RGBA to ARGB4444 format.
   * Format: AAAA RRRR GGGG BBBB (4-4-4-4)
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @param {number} a - Alpha (0-255)
   * @return {number} 16-bit ARGB4444 value
   */
  DreamcastConsoleMode.prototype.toARGB4444 = function (r, g, b, a) {
    var a4 = Math.round(a * 15 / 255);
    var r4 = Math.round(r * 15 / 255);
    var g4 = Math.round(g * 15 / 255);
    var b4 = Math.round(b * 15 / 255);
    return (a4 << 12) | (r4 << 8) | (g4 << 4) | b4;
  };

  // =========================================================================
  // Twiddling (Morton Order) Methods
  // =========================================================================

  /**
   * Spreads bits of a number to even positions for Morton code.
   * Example: 0b1011 → 0b01000101
   * @param {number} n - Input value (up to 10 bits for 1024 max)
   * @return {number} Value with bits spread to even positions
   */
  DreamcastConsoleMode.prototype.spreadBits = function (n) {
    n = (n | (n << 8)) & 0x00FF00FF;
    n = (n | (n << 4)) & 0x0F0F0F0F;
    n = (n | (n << 2)) & 0x33333333;
    n = (n | (n << 1)) & 0x55555555;
    return n;
  };

  /**
   * Computes Morton code (Z-order index) from 2D coordinates.
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @return {number} Morton code (twiddled index)
   */
  DreamcastConsoleMode.prototype.mortonCode = function (x, y) {
    return this.spreadBits(x) | (this.spreadBits(y) << 1);
  };

  /**
   * Extracts even-position bits (X coordinate from Morton code).
   * @param {number} n - Morton code
   * @return {number} X coordinate
   */
  DreamcastConsoleMode.prototype.deinterleaveEven = function (n) {
    n = n & 0x55555555;
    n = (n | (n >> 1)) & 0x33333333;
    n = (n | (n >> 2)) & 0x0F0F0F0F;
    n = (n | (n >> 4)) & 0x00FF00FF;
    n = (n | (n >> 8)) & 0x0000FFFF;
    return n;
  };

  /**
   * Extracts odd-position bits (Y coordinate from Morton code).
   * @param {number} n - Morton code
   * @return {number} Y coordinate
   */
  DreamcastConsoleMode.prototype.deinterleaveOdd = function (n) {
    return this.deinterleaveEven(n >> 1);
  };

  /**
   * Twiddles a square texture's pixel data into Morton order.
   * @param {Uint16Array} linear - Source pixels in row-major order
   * @param {number} size - Texture width/height (must be equal, power of 2)
   * @return {Uint16Array} Twiddled pixel data
   */
  DreamcastConsoleMode.prototype.twiddleSquare = function (linear, size) {
    var twiddled = new Uint16Array(size * size);
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var linearIndex = y * size + x;
        var twiddledIndex = this.mortonCode(x, y);
        twiddled[twiddledIndex] = linear[linearIndex];
      }
    }
    return twiddled;
  };

  /**
   * Twiddles a rectangular texture by processing square BOIN blocks.
   * @param {Uint16Array} linear - Source pixels in row-major order
   * @param {number} width - Texture width (power of 2)
   * @param {number} height - Texture height (power of 2)
   * @return {Uint16Array} Twiddled pixel data
   */
  DreamcastConsoleMode.prototype.twiddleRectangular = function (
    linear, width, height
  ) {
    var twiddled = new Uint16Array(width * height);
    var boinSize = Math.min(width, height);
    var numBoinX = width / boinSize;
    var numBoinY = height / boinSize;
    var outIndex = 0;

    for (var boinY = 0; boinY < numBoinY; boinY++) {
      for (var boinX = 0; boinX < numBoinX; boinX++) {
        var baseX = boinX * boinSize;
        var baseY = boinY * boinSize;

        // Twiddle within this BOIN block
        for (var i = 0; i < boinSize * boinSize; i++) {
          var localX = this.deinterleaveEven(i);
          var localY = this.deinterleaveOdd(i);
          var srcIndex = (baseY + localY) * width + (baseX + localX);
          twiddled[outIndex++] = linear[srcIndex];
        }
      }
    }

    return twiddled;
  };

  /**
   * Twiddles pixel data, handling both square and rectangular textures.
   * @param {Uint16Array} linear - Source pixels in row-major order
   * @param {number} width - Texture width (power of 2)
   * @param {number} height - Texture height (power of 2)
   * @return {Uint16Array} Twiddled pixel data
   */
  DreamcastConsoleMode.prototype.twiddlePixels = function (
    linear, width, height
  ) {
    if (width === height) {
      return this.twiddleSquare(linear, width);
    }
    return this.twiddleRectangular(linear, width, height);
  };

  // =========================================================================
  // Validation Methods
  // =========================================================================

  /**
   * Checks if a number is a power of 2.
   * @param {number} n - Number to check
   * @return {boolean} True if power of 2
   */
  DreamcastConsoleMode.prototype.isPowerOfTwo = function (n) {
    return n > 0 && (n & (n - 1)) === 0;
  };

  /**
   * Gets the next power of 2 >= n.
   * @param {number} n - Input number
   * @return {number} Next power of 2
   */
  DreamcastConsoleMode.prototype.nextPowerOfTwo = function (n) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  };

  /**
   * Validates texture dimensions for Dreamcast.
   * @param {number} width - Texture width
   * @param {number} height - Texture height
   * @return {Array<Object>} Array of validation issues
   */
  DreamcastConsoleMode.prototype.validateDimensions = function (width, height) {
    var issues = [];

    if (!this.isPowerOfTwo(width)) {
      issues.push({
        type: 'error',
        field: 'width',
        message: 'Width ' + width + ' is not power of 2',
        suggestion: this.nextPowerOfTwo(width)
      });
    }

    if (!this.isPowerOfTwo(height)) {
      issues.push({
        type: 'error',
        field: 'height',
        message: 'Height ' + height + ' is not power of 2',
        suggestion: this.nextPowerOfTwo(height)
      });
    }

    if (width > 1024) {
      issues.push({
        type: 'error',
        field: 'width',
        message: 'Width exceeds maximum (1024)'
      });
    }

    if (height > 1024) {
      issues.push({
        type: 'error',
        field: 'height',
        message: 'Height exceeds maximum (1024)'
      });
    }

    return issues;
  };

  /**
   * Creates and returns a new Dreamcast console mode instance.
   * @return {DreamcastConsoleMode}
   */
  ns.createDreamcastMode = function () {
    return new DreamcastConsoleMode();
  };

  // Export constants for use by exporters and other code
  ns.DreamcastConstants = {
    // Pixel format codes for PVR header
    PIXEL_FORMAT_ARGB1555: 0x00,
    PIXEL_FORMAT_RGB565: 0x01,
    PIXEL_FORMAT_ARGB4444: 0x02,

    // Data format codes for PVR header
    DATA_FORMAT_TWIDDLED: 0x01,
    DATA_FORMAT_RECTANGLE: 0x09,

    // Size constraints
    MAX_DIMENSION: 1024,
    MIN_DIMENSION: 8,

    // File format
    GBIX_MAGIC: 0x58494247,  // "GBIX" little-endian
    PVRT_MAGIC: 0x54525650,  // "PVRT" little-endian
    GBIX_HEADER_SIZE: 16,
    PVRT_HEADER_SIZE: 16,

    // Bytes per pixel
    BYTES_PER_PIXEL: 2
  };
})();
