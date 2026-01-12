/**
 * Controller for Sega Master System 4BPP tile + palette export.
 *
 * 4BPP format: 32 bytes per 8x8 tile (same as Genesis)
 *   - Each row is 4 bytes (8 pixels × 4 bits = 32 bits)
 *   - Pixels packed left-to-right, high nibble first
 *   - Row 0 bytes 0-3, Row 1 bytes 4-7, ... Row 7 bytes 28-31
 *
 * Palette format: 16 bytes for 16-color palette
 *   - Each color is 1 byte in SMS CRAM format
 *   - Format: --BBGGRR (6-bit RGB222)
 *
 * Exports:
 *   - .4bpp file: Tile data (all frames concatenated)
 *   - .pal file: Palette data (CRAM format, 16 bytes)
 *
 * References:
 *   - https://www.smspower.org/Development/Palette
 *   - https://www.smspower.org/Development/Sprites
 */
(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  /** @const {number} Max colors per sprite (15 + transparent). */
  var MAX_COLORS = 15;

  ns.Sms4bppExportController = function (piskelController) {
    this.piskelController = piskelController;
    this.colorMap = {};       // Maps color int -> index (0-15)
    this.paletteColors = [];  // Array of hex colors in order
  };

  pskl.utils.inherit(ns.Sms4bppExportController,
    pskl.controller.settings.AbstractSettingController);

  ns.Sms4bppExportController.prototype.init = function () {
    this.validateAndDisplay_();

    var tilesBtn = document.querySelector('.sms4bpp-download-tiles-button');
    var palBtn = document.querySelector('.sms4bpp-download-pal-button');
    var bothBtn = document.querySelector('.sms4bpp-download-both-button');

    this.addEventListener(tilesBtn, 'click', this.onDownloadTilesClick_);
    this.addEventListener(palBtn, 'click', this.onDownloadPaletteClick_);
    this.addEventListener(bothBtn, 'click', this.onDownloadBothClick_);

    // Listen for color changes to update display
    $.subscribe(Events.CURRENT_COLORS_UPDATED,
      this.validateAndDisplay_.bind(this));
  };

  /**
   * Updates color map, download info, and color warning display.
   * @private
   */
  ns.Sms4bppExportController.prototype.validateAndDisplay_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    // Get current colors and check if over limit
    var colors = pskl.app.currentColorsService.getCurrentColors();
    var colorCount = colors.length;
    var hasTooManyColors = colorCount > MAX_COLORS;

    // Show/hide color warning
    var warning = document.querySelector('.sms4bpp-color-warning');
    if (warning) {
      warning.style.display = hasTooManyColors ? 'flex' : 'none';
    }

    // Build color map for export (up to 15 colors + transparent)
    this.colorMap = {};
    this.paletteColors = [];
    this.colorMap[0] = 0;  // Transparent maps to index 0
    this.paletteColors.push(null);  // Index 0 = transparent

    // Map up to 15 non-transparent colors
    var maxColors = Math.min(colorCount, MAX_COLORS);
    for (var i = 0; i < maxColors; i++) {
      var colorInt = pskl.utils.colorToInt(colors[i]);
      this.colorMap[colorInt] = i + 1;
      this.paletteColors.push(colors[i]);
    }

    // Pad palette to 16 colors if needed
    while (this.paletteColors.length < 16) {
      this.paletteColors.push('#000000');
    }

    // Update download info
    var tilesPerFrame = (width / 8) * (height / 8);
    var totalTileBytes = frameCount * tilesPerFrame * 32;  // 32 bytes per tile
    var paletteBytes = 16;  // 16 colors × 1 byte (SMS CRAM)

    var tilesInfo = document.querySelector('.sms4bpp-tiles-info');
    var palInfo = document.querySelector('.sms4bpp-pal-info');

    if (tilesInfo) {
      tilesInfo.innerHTML = totalTileBytes + ' bytes' +
        (frameCount > 1 ? ' (' + frameCount + ' frames)' : '');
    }
    if (palInfo) {
      palInfo.innerHTML = paletteBytes + ' bytes (' + colorCount +
        '/' + MAX_COLORS + ' colors)';
    }
  };

  /**
   * Handles tiles download button click.
   * @private
   */
  ns.Sms4bppExportController.prototype.onDownloadTilesClick_ = function () {
    var data = this.generate4bppData_();
    if (data) {
      var fileName = this.getPiskelName_() + '.4bpp';
      var blob = new Blob([data], {type: 'application/octet-stream'});
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    }
  };

  /**
   * Handles palette download button click.
   * @private
   */
  ns.Sms4bppExportController.prototype.onDownloadPaletteClick_ = function () {
    var data = this.generatePaletteData_();
    if (data) {
      var fileName = this.getPiskelName_() + '.pal';
      var blob = new Blob([data], {type: 'application/octet-stream'});
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    }
  };

  /**
   * Handles combined download button click.
   * @private
   */
  ns.Sms4bppExportController.prototype.onDownloadBothClick_ = function () {
    this.onDownloadTilesClick_();
    // Small delay to avoid browser blocking multiple downloads
    setTimeout(this.onDownloadPaletteClick_.bind(this), 100);
  };

  /**
   * Generates the binary 4BPP tile data for all frames.
   * SMS 4BPP format: packed pixels, 4 bytes per row (same as Genesis).
   * @return {Uint8Array} The 4BPP file bytes
   * @private
   */
  ns.Sms4bppExportController.prototype.generate4bppData_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    var tilesX = width / 8;
    var tilesY = height / 8;
    var tilesPerFrame = tilesX * tilesY;
    var totalBytes = frameCount * tilesPerFrame * 32;  // 32 bytes per tile

    var bytes = new Uint8Array(totalBytes);
    var byteIndex = 0;

    for (var f = 0; f < frameCount; f++) {
      var render = this.piskelController.renderFrameAt(f, true);
      var ctx = render.getContext('2d');
      var imgData = ctx.getImageData(0, 0, width, height);
      var pixels = imgData.data;

      for (var tileY = 0; tileY < tilesY; tileY++) {
        for (var tileX = 0; tileX < tilesX; tileX++) {
          var tileBytes = this.encodeTile_(
            pixels, width, tileX * 8, tileY * 8
          );
          bytes.set(tileBytes, byteIndex);
          byteIndex += 32;
        }
      }
    }

    return bytes;
  };

  /**
   * Generates the binary palette data in SMS CRAM format.
   * @return {Uint8Array} The palette file bytes (16 bytes)
   * @private
   */
  ns.Sms4bppExportController.prototype.generatePaletteData_ = function () {
    var smsMode = pskl.app.consoleRegistry.get('sms');
    var bytes = new Uint8Array(16);

    for (var i = 0; i < 16; i++) {
      var color = this.paletteColors[i];

      if (i === 0 || color === null) {
        // Transparent: use black
        bytes[i] = 0x00;
      } else if (smsMode) {
        bytes[i] = smsMode.colorToCRAMByte(color);
      } else {
        // Fallback: simple conversion
        var tc = window.tinycolor(color).toRgb();
        var r2 = Math.round(tc.r * 3 / 255);
        var g2 = Math.round(tc.g * 3 / 255);
        var b2 = Math.round(tc.b * 3 / 255);
        bytes[i] = (b2 << 4) | (g2 << 2) | r2;
      }
    }

    return bytes;
  };

  /**
   * Encodes a single 8x8 tile to 32 bytes in 4BPP format.
   *
   * 4BPP format: packed pixels, 4 bytes per row
   *   - Each pixel is 4 bits (nibble)
   *   - Pixels packed left-to-right
   *   - High nibble = left pixel, low nibble = right pixel
   *   - 8 pixels = 4 bytes per row
   *   - 8 rows = 32 bytes per tile
   *
   * @param {Uint8ClampedArray} pixels - Full image RGBA data
   * @param {number} imgWidth - Full image width
   * @param {number} startX - Tile start X coordinate
   * @param {number} startY - Tile start Y coordinate
   * @return {Uint8Array} 32 bytes for this tile
   * @private
   */
  ns.Sms4bppExportController.prototype.encodeTile_ = function (
    pixels, imgWidth, startX, startY
  ) {
    var tile = new Uint8Array(32);
    var tileIndex = 0;

    for (var y = 0; y < 8; y++) {
      // Process 8 pixels per row, packed into 4 bytes
      for (var xPair = 0; xPair < 4; xPair++) {
        var x0 = xPair * 2;      // Left pixel of pair
        var x1 = xPair * 2 + 1;  // Right pixel of pair

        var px0 = startX + x0;
        var py = startY + y;
        var idx0 = (py * imgWidth + px0) * 4;

        var px1 = startX + x1;
        var idx1 = (py * imgWidth + px1) * 4;

        var colorIndex0 = this.getColorIndex_(
          pixels[idx0], pixels[idx0 + 1], pixels[idx0 + 2], pixels[idx0 + 3]
        );
        var colorIndex1 = this.getColorIndex_(
          pixels[idx1], pixels[idx1 + 1], pixels[idx1 + 2], pixels[idx1 + 3]
        );

        // Pack two 4-bit indices into one byte
        // High nibble = left pixel, low nibble = right pixel
        tile[tileIndex++] = (colorIndex0 << 4) | colorIndex1;
      }
    }

    return tile;
  };

  /**
   * Maps an RGBA pixel to a color index 0-15.
   * @param {number} r - Red component (0-255)
   * @param {number} g - Green component (0-255)
   * @param {number} b - Blue component (0-255)
   * @param {number} a - Alpha component (0-255)
   * @return {number} Color index 0-15
   * @private
   */
  ns.Sms4bppExportController.prototype.getColorIndex_ = function (
    r, g, b, a
  ) {
    if (a < 128) {
      return 0;
    }

    var colorInt = (255 << 24 >>> 0) + (b << 16) + (g << 8) + r;

    if (this.colorMap.hasOwnProperty(colorInt)) {
      return this.colorMap[colorInt];
    }

    console.warn('Unmapped color during SMS 4BPP export:', r, g, b);
    return 1;
  };

  /**
   * Gets the current piskel name for the filename.
   * @return {string} Piskel name
   * @private
   */
  ns.Sms4bppExportController.prototype.getPiskelName_ = function () {
    return this.piskelController.getPiskel().getDescriptor().name;
  };
})();
