/**
 * Controller for Game Boy 2BPP tile export.
 *
 * 2BPP format: 16 bytes per 8x8 tile (interleaved)
 *   - For each row: low byte (bit 0), then high byte (bit 1)
 *   - 8 rows × 2 bytes = 16 bytes per tile
 *
 * This differs from NES CHR which uses planar format (all low bytes first).
 *
 * Note: Exports ALL frames into a single .2bpp file. Tiles from each
 * frame are concatenated sequentially.
 */
(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  ns.Gb2bppExportController = function (piskelController) {
    this.piskelController = piskelController;
    this.colorMap = {};  // Maps color int -> shade index (0-3)
  };

  pskl.utils.inherit(ns.Gb2bppExportController,
    pskl.controller.settings.AbstractSettingController);

  ns.Gb2bppExportController.prototype.init = function () {
    this.validateAndDisplay_();

    var downloadBtn = document.querySelector('.gb2bpp-download-button');
    this.addEventListener(downloadBtn, 'click', this.onDownloadClick_);

    // Listen for color changes to update color map
    $.subscribe(Events.CURRENT_COLORS_UPDATED,
      this.validateAndDisplay_.bind(this));
  };

  /**
   * Updates color map and download info display.
   * @private
   */
  ns.Gb2bppExportController.prototype.validateAndDisplay_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    // Build color map for export using Game Boy shade mapping
    var colors = pskl.app.currentColorsService.getCurrentColors();
    this.colorMap = {};
    this.colorMap[0] = 0;  // Transparent (alpha = 0) maps to shade 0

    var gbMode = pskl.app.consoleRegistry.get('gameboy');
    for (var i = 0; i < Math.min(colors.length, 3); i++) {
      var colorInt = pskl.utils.colorToInt(colors[i]);
      // Try to get the actual GB shade, fallback to index-based
      var shade = gbMode ? gbMode.getShadeForColor(colors[i]) : null;
      this.colorMap[colorInt] = shade !== null ? shade : (i + 1);
    }

    // Update download info text
    var totalBytes = frameCount * (width / 8) * (height / 8) * 16;
    var downloadInfo = document.querySelector('.gb2bpp-download-info');
    downloadInfo.innerHTML = totalBytes + ' bytes' +
      (frameCount > 1 ? ' (' + frameCount + ' frames)' : '');
  };

  /**
   * Handles download button click.
   * @private
   */
  ns.Gb2bppExportController.prototype.onDownloadClick_ = function () {
    var data = this.generate2bppData_();
    if (data) {
      var fileName = this.getPiskelName_() + '.2bpp';
      var blob = new Blob([data], {type: 'application/octet-stream'});
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    }
  };

  /**
   * Generates the binary 2BPP data for all frames.
   * @return {Uint8Array} The 2BPP file bytes
   * @private
   */
  ns.Gb2bppExportController.prototype.generate2bppData_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    var tilesX = width / 8;
    var tilesY = height / 8;
    var tilesPerFrame = tilesX * tilesY;
    var totalBytes = frameCount * tilesPerFrame * 16;

    var bytes = new Uint8Array(totalBytes);
    var byteIndex = 0;

    for (var f = 0; f < frameCount; f++) {
      var render = this.piskelController.renderFrameAt(f, true);
      var ctx = render.getContext('2d');
      var imgData = ctx.getImageData(0, 0, width, height);
      var pixels = imgData.data;

      // Process each 8x8 tile (row by row, left to right)
      for (var tileY = 0; tileY < tilesY; tileY++) {
        for (var tileX = 0; tileX < tilesX; tileX++) {
          var tileBytes = this.encodeTile_(
            pixels, width, tileX * 8, tileY * 8
          );
          bytes.set(tileBytes, byteIndex);
          byteIndex += 16;
        }
      }
    }

    return bytes;
  };

  /**
   * Encodes a single 8x8 tile to 16 bytes in Game Boy 2BPP format.
   *
   * Game Boy 2BPP uses INTERLEAVED format:
   *   - For each row: byte0 = bit0 of pixels, byte1 = bit1 of pixels
   *   - Low byte first, then high byte, for each of 8 rows
   *
   * This differs from NES CHR which stores all low bytes, then all high.
   *
   * @param {Uint8ClampedArray} pixels - Full image RGBA data
   * @param {number} imgWidth - Full image width
   * @param {number} startX - Tile start X coordinate
   * @param {number} startY - Tile start Y coordinate
   * @return {Uint8Array} 16 bytes for this tile
   * @private
   */
  ns.Gb2bppExportController.prototype.encodeTile_ = function (
    pixels, imgWidth, startX, startY
  ) {
    var tile = new Uint8Array(16);
    var byteIdx = 0;

    for (var y = 0; y < 8; y++) {
      var lowByte = 0;
      var highByte = 0;

      for (var x = 0; x < 8; x++) {
        var px = startX + x;
        var py = startY + y;
        var idx = (py * imgWidth + px) * 4;

        var r = pixels[idx];
        var g = pixels[idx + 1];
        var b = pixels[idx + 2];
        var a = pixels[idx + 3];

        // Get shade index (0-3)
        var shade = this.getShadeIndex_(r, g, b, a);

        // Set bits (MSB first: bit 7 = leftmost pixel x=0)
        var bitPos = 7 - x;
        lowByte |= ((shade & 1) << bitPos);
        highByte |= (((shade >> 1) & 1) << bitPos);
      }

      // Interleaved: low byte, then high byte for each row
      tile[byteIdx++] = lowByte;
      tile[byteIdx++] = highByte;
    }

    return tile;
  };

  /**
   * Maps an RGBA pixel to a shade index 0-3.
   * @param {number} r - Red component (0-255)
   * @param {number} g - Green component (0-255)
   * @param {number} b - Blue component (0-255)
   * @param {number} a - Alpha component (0-255)
   * @return {number} Shade index 0-3
   * @private
   */
  ns.Gb2bppExportController.prototype.getShadeIndex_ = function (r, g, b, a) {
    // Transparent pixels -> shade 0 (lightest, used as transparent in sprites)
    if (a < 128) {
      return 0;
    }

    // Convert RGBA to int format used by Piskel
    var colorInt = (255 << 24 >>> 0) + (b << 16) + (g << 8) + r;

    if (this.colorMap.hasOwnProperty(colorInt)) {
      return this.colorMap[colorInt];
    }

    // Color not in map - shouldn't happen if validation passed
    // Default to shade 1 as fallback
    console.warn('Unmapped color during 2BPP export:', r, g, b);
    return 1;
  };

  /**
   * Gets the current piskel name for the filename.
   * @return {string} Piskel name
   * @private
   */
  ns.Gb2bppExportController.prototype.getPiskelName_ = function () {
    return this.piskelController.getPiskel().getDescriptor().name;
  };
})();

