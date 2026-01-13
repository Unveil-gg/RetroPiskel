/**
 * Controller for MSX1 1BPP pattern + color table export.
 *
 * 1BPP format: 8 bytes per 8x8 tile (1 bit per pixel)
 *   - Each row is 1 byte (8 pixels × 1 bit = 8 bits)
 *   - Pixels packed left-to-right, MSB first
 *   - Row 0 byte 0, Row 1 byte 1, ... Row 7 byte 7
 *
 * Color table format: 1 byte per 8 pixel rows (foreground/background)
 *   - Format: FFFFBBBB (foreground color 4 bits, background color 4 bits)
 *   - In MSX1, typically one color byte per 8 pixel row
 *
 * Exports:
 *   - .1bpp file: Pattern data (all frames concatenated)
 *   - .clr file: Color table data
 *
 * References:
 *   - https://www.msx.org/wiki/Category:VDP
 *   - TMS9918A datasheet
 */
(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  /** @const {number} Max non-transparent colors (MSX1 sprites = monochrome). */
  var MAX_COLORS = 1;

  ns.Msx1bppExportController = function (piskelController) {
    this.piskelController = piskelController;
    this.foregroundColor = null;  // The single sprite color
    this.foregroundIndex = 1;     // TMS9918 color index (1-15)
  };

  pskl.utils.inherit(ns.Msx1bppExportController,
    pskl.controller.settings.AbstractSettingController);

  ns.Msx1bppExportController.prototype.init = function () {
    this.validateAndDisplay_();

    var patternBtn = document.querySelector('.msx1bpp-download-pattern-button');
    var colorBtn = document.querySelector('.msx1bpp-download-color-button');
    var bothBtn = document.querySelector('.msx1bpp-download-both-button');

    this.addEventListener(patternBtn, 'click', this.onDownloadPatternClick_);
    this.addEventListener(colorBtn, 'click', this.onDownloadColorClick_);
    this.addEventListener(bothBtn, 'click', this.onDownloadBothClick_);

    $.subscribe(Events.CURRENT_COLORS_UPDATED,
      this.validateAndDisplay_.bind(this));
  };

  /**
   * Updates color info, download info, and color warning display.
   * @private
   */
  ns.Msx1bppExportController.prototype.validateAndDisplay_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    var colors = pskl.app.currentColorsService.getCurrentColors();
    var colorCount = colors.length;
    var hasTooManyColors = colorCount > MAX_COLORS;

    var warning = document.querySelector('.msx1bpp-color-warning');
    if (warning) {
      warning.style.display = hasTooManyColors ? 'flex' : 'none';
    }

    // Get the foreground color (first non-transparent color)
    this.foregroundColor = colors.length > 0 ? colors[0] : '#FFFFFF';
    this.foregroundIndex = this.getColorIndex_(this.foregroundColor);

    // Calculate sizes
    var tilesPerFrame = (width / 8) * (height / 8);
    var totalPatternBytes = frameCount * tilesPerFrame * 8;  // 8 bytes/tile
    var totalColorBytes = frameCount * tilesPerFrame * 8;    // 8 bytes/tile

    var patternInfo = document.querySelector('.msx1bpp-pattern-info');
    var colorInfo = document.querySelector('.msx1bpp-color-info');

    if (patternInfo) {
      patternInfo.innerHTML = totalPatternBytes + ' bytes' +
        (frameCount > 1 ? ' (' + frameCount + ' frames)' : '');
    }
    if (colorInfo) {
      colorInfo.innerHTML = totalColorBytes + ' bytes (color: ' +
        this.foregroundIndex + ')';
    }
  };

  /**
   * Gets TMS9918 color index for a hex color.
   * @param {string} hexColor - Hex color string
   * @return {number} TMS9918 color index (1-15)
   * @private
   */
  ns.Msx1bppExportController.prototype.getColorIndex_ = function (hexColor) {
    var msxMode = pskl.app.consoleRegistry.get('msx');
    if (msxMode) {
      var index = msxMode.getIndexForColor(hexColor);
      if (index !== null) {
        return index;
      }
    }
    return 15;  // Default to white
  };

  /**
   * Handles pattern download button click.
   * @private
   */
  ns.Msx1bppExportController.prototype.onDownloadPatternClick_ = function () {
    var data = this.generate1bppData_();
    if (data) {
      var fileName = this.getPiskelName_() + '.1bpp';
      var blob = new Blob([data], {type: 'application/octet-stream'});
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    }
  };

  /**
   * Handles color table download button click.
   * @private
   */
  ns.Msx1bppExportController.prototype.onDownloadColorClick_ = function () {
    var data = this.generateColorData_();
    if (data) {
      var fileName = this.getPiskelName_() + '.clr';
      var blob = new Blob([data], {type: 'application/octet-stream'});
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    }
  };

  /**
   * Handles combined download button click.
   * @private
   */
  ns.Msx1bppExportController.prototype.onDownloadBothClick_ = function () {
    this.onDownloadPatternClick_();
    setTimeout(this.onDownloadColorClick_.bind(this), 100);
  };

  /**
   * Generates the binary 1BPP pattern data for all frames.
   * @return {Uint8Array} The 1BPP pattern bytes
   * @private
   */
  ns.Msx1bppExportController.prototype.generate1bppData_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    var tilesX = width / 8;
    var tilesY = height / 8;
    var tilesPerFrame = tilesX * tilesY;
    var totalBytes = frameCount * tilesPerFrame * 8;

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
          byteIndex += 8;
        }
      }
    }

    return bytes;
  };

  /**
   * Generates the color table data.
   * For MSX1 sprites, each row of 8 pixels has a color byte.
   * Format: FFFFBBBB (foreground/background)
   * @return {Uint8Array} The color table bytes
   * @private
   */
  ns.Msx1bppExportController.prototype.generateColorData_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    var tilesX = width / 8;
    var tilesY = height / 8;
    var tilesPerFrame = tilesX * tilesY;
    var totalBytes = frameCount * tilesPerFrame * 8;

    var bytes = new Uint8Array(totalBytes);
    // Fill with foreground color (background = 0 for transparent)
    var colorByte = (this.foregroundIndex << 4) | 0;

    for (var i = 0; i < totalBytes; i++) {
      bytes[i] = colorByte;
    }

    return bytes;
  };

  /**
   * Encodes a single 8x8 tile to 8 bytes in 1BPP format.
   * @param {Uint8ClampedArray} pixels - Full image RGBA data
   * @param {number} imgWidth - Full image width
   * @param {number} startX - Tile start X coordinate
   * @param {number} startY - Tile start Y coordinate
   * @return {Uint8Array} 8 bytes for this tile
   * @private
   */
  ns.Msx1bppExportController.prototype.encodeTile_ = function (
    pixels, imgWidth, startX, startY
  ) {
    var tile = new Uint8Array(8);

    for (var y = 0; y < 8; y++) {
      var rowByte = 0;

      for (var x = 0; x < 8; x++) {
        var px = startX + x;
        var py = startY + y;
        var idx = (py * imgWidth + px) * 4;

        // Check if pixel is non-transparent (alpha >= 128)
        var isSet = pixels[idx + 3] >= 128;

        if (isSet) {
          // Set bit (MSB first, so bit 7 is leftmost pixel)
          rowByte |= (1 << (7 - x));
        }
      }

      tile[y] = rowByte;
    }

    return tile;
  };

  /**
   * Gets the current piskel name for the filename.
   * @return {string} Piskel name
   * @private
   */
  ns.Msx1bppExportController.prototype.getPiskelName_ = function () {
    return this.piskelController.getPiskel().getDescriptor().name;
  };
})();
