/**
 * Controller for MSX2 4BPP tile + V9938 palette export.
 *
 * 4BPP format: 32 bytes per 8x8 tile
 *   - Each row is 4 bytes (8 pixels × 4 bits = 32 bits)
 *   - Pixels packed left-to-right, high nibble first
 *   - Row 0 bytes 0-3, Row 1 bytes 4-7, ... Row 7 bytes 28-31
 *
 * Palette format: 32 bytes for 16-color palette
 *   - Each color is 2 bytes in V9938 format
 *   - Format: 0RRR0GGG 0BBB0000 (RGB333)
 *
 * Exports:
 *   - .4bpp file: Tile data (all frames concatenated)
 *   - .pal file: Palette data (V9938 format, 32 bytes)
 *
 * References:
 *   - https://www.msx.org/wiki/V9938
 *   - https://konamiman.github.io/MSX2-Technical-Handbook/
 */
(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  /** @const {number} Max colors per sprite (15 + transparent). */
  var MAX_COLORS = 15;

  ns.Msx24bppExportController = function (piskelController) {
    this.piskelController = piskelController;
    this.colorMap = {};
    this.paletteColors = [];
  };

  pskl.utils.inherit(ns.Msx24bppExportController,
    pskl.controller.settings.AbstractSettingController);

  ns.Msx24bppExportController.prototype.init = function () {
    this.validateAndDisplay_();

    var tilesBtn = document.querySelector('.msx24bpp-download-tiles-button');
    var palBtn = document.querySelector('.msx24bpp-download-pal-button');
    var bothBtn = document.querySelector('.msx24bpp-download-both-button');

    this.addEventListener(tilesBtn, 'click', this.onDownloadTilesClick_);
    this.addEventListener(palBtn, 'click', this.onDownloadPaletteClick_);
    this.addEventListener(bothBtn, 'click', this.onDownloadBothClick_);

    $.subscribe(Events.CURRENT_COLORS_UPDATED,
      this.validateAndDisplay_.bind(this));
  };

  /**
   * Updates color map, download info, and color warning display.
   * @private
   */
  ns.Msx24bppExportController.prototype.validateAndDisplay_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    var colors = pskl.app.currentColorsService.getCurrentColors();
    var colorCount = colors.length;
    var hasTooManyColors = colorCount > MAX_COLORS;

    var warning = document.querySelector('.msx24bpp-color-warning');
    if (warning) {
      warning.style.display = hasTooManyColors ? 'flex' : 'none';
    }

    // Build color map
    this.colorMap = {};
    this.paletteColors = [];
    this.colorMap[0] = 0;
    this.paletteColors.push(null);

    var maxColors = Math.min(colorCount, MAX_COLORS);
    for (var i = 0; i < maxColors; i++) {
      var colorInt = pskl.utils.colorToInt(colors[i]);
      this.colorMap[colorInt] = i + 1;
      this.paletteColors.push(colors[i]);
    }

    while (this.paletteColors.length < 16) {
      this.paletteColors.push('#000000');
    }

    // Update download info
    var tilesPerFrame = (width / 8) * (height / 8);
    var totalTileBytes = frameCount * tilesPerFrame * 32;
    var paletteBytes = 32;  // 16 colors × 2 bytes

    var tilesInfo = document.querySelector('.msx24bpp-tiles-info');
    var palInfo = document.querySelector('.msx24bpp-pal-info');

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
  ns.Msx24bppExportController.prototype.onDownloadTilesClick_ = function () {
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
  ns.Msx24bppExportController.prototype.onDownloadPaletteClick_ = function () {
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
  ns.Msx24bppExportController.prototype.onDownloadBothClick_ = function () {
    this.onDownloadTilesClick_();
    setTimeout(this.onDownloadPaletteClick_.bind(this), 100);
  };

  /**
   * Generates the binary 4BPP tile data for all frames.
   * @return {Uint8Array} The 4BPP file bytes
   * @private
   */
  ns.Msx24bppExportController.prototype.generate4bppData_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    var tilesX = width / 8;
    var tilesY = height / 8;
    var tilesPerFrame = tilesX * tilesY;
    var totalBytes = frameCount * tilesPerFrame * 32;

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
   * Generates the binary palette data in V9938 format.
   * @return {Uint8Array} The palette file bytes (32 bytes)
   * @private
   */
  ns.Msx24bppExportController.prototype.generatePaletteData_ = function () {
    var msx2Mode = pskl.app.consoleRegistry.get('msx2');
    var bytes = new Uint8Array(32);

    for (var i = 0; i < 16; i++) {
      var color = this.paletteColors[i];
      var byteOffset = i * 2;

      if (i === 0 || color === null) {
        bytes[byteOffset] = 0x00;
        bytes[byteOffset + 1] = 0x00;
      } else if (msx2Mode) {
        var palBytes = msx2Mode.colorToPaletteBytes(color);
        bytes[byteOffset] = palBytes[0];
        bytes[byteOffset + 1] = palBytes[1];
      } else {
        // Fallback: simple RGB333 conversion
        var tc = window.tinycolor(color).toRgb();
        var r3 = Math.round(tc.r * 7 / 255);
        var g3 = Math.round(tc.g * 7 / 255);
        var b3 = Math.round(tc.b * 7 / 255);
        bytes[byteOffset] = (r3 << 4) | g3;
        bytes[byteOffset + 1] = (b3 << 4);
      }
    }

    return bytes;
  };

  /**
   * Encodes a single 8x8 tile to 32 bytes in 4BPP format.
   * @param {Uint8ClampedArray} pixels - Full image RGBA data
   * @param {number} imgWidth - Full image width
   * @param {number} startX - Tile start X coordinate
   * @param {number} startY - Tile start Y coordinate
   * @return {Uint8Array} 32 bytes for this tile
   * @private
   */
  ns.Msx24bppExportController.prototype.encodeTile_ = function (
    pixels, imgWidth, startX, startY
  ) {
    var tile = new Uint8Array(32);
    var tileIndex = 0;

    for (var y = 0; y < 8; y++) {
      for (var xPair = 0; xPair < 4; xPair++) {
        var x0 = xPair * 2;
        var x1 = xPair * 2 + 1;

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
  ns.Msx24bppExportController.prototype.getColorIndex_ = function (
    r, g, b, a
  ) {
    if (a < 128) {
      return 0;
    }

    var colorInt = (255 << 24 >>> 0) + (b << 16) + (g << 8) + r;

    if (this.colorMap.hasOwnProperty(colorInt)) {
      return this.colorMap[colorInt];
    }

    console.warn('Unmapped color during MSX2 4BPP export:', r, g, b);
    return 1;
  };

  /**
   * Gets the current piskel name for the filename.
   * @return {string} Piskel name
   * @private
   */
  ns.Msx24bppExportController.prototype.getPiskelName_ = function () {
    return this.piskelController.getPiskel().getDescriptor().name;
  };
})();
