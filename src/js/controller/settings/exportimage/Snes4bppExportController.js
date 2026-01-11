/**
 * Controller for SNES 4BPP tile + palette export.
 *
 * 4BPP format: 32 bytes per 8x8 tile (bitplane interleaved)
 *   - First 16 bytes: Bitplanes 0-1 interleaved (like GB 2BPP)
 *     Row0-BP0, Row0-BP1, Row1-BP0, Row1-BP1, ... Row7-BP0, Row7-BP1
 *   - Last 16 bytes: Bitplanes 2-3 interleaved
 *     Row0-BP2, Row0-BP3, Row1-BP2, Row1-BP3, ... Row7-BP2, Row7-BP3
 *
 * Palette format: 32 bytes for 16-color palette
 *   - Each color is 2 bytes in BGR555 little-endian format
 *   - byte0 = GGGRRRRR, byte1 = 0BBBBBGG
 *
 * Exports:
 *   - .4bpp file: Tile data (all frames concatenated)
 *   - .pal file: Palette data (BGR555 format)
 *
 * References:
 *   - https://snes.nesdev.org/wiki/Sprites
 *   - https://snes.nesdev.org/wiki/Tile_data
 */
(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  /** @const {number} Max colors per sprite (15 + transparent). */
  var MAX_COLORS = 15;

  ns.Snes4bppExportController = function (piskelController) {
    this.piskelController = piskelController;
    this.colorMap = {};       // Maps color int -> index (0-15)
    this.paletteColors = [];  // Array of hex colors in order
  };

  pskl.utils.inherit(ns.Snes4bppExportController,
    pskl.controller.settings.AbstractSettingController);

  ns.Snes4bppExportController.prototype.init = function () {
    this.validateAndDisplay_();

    var tilesBtn = document.querySelector('.snes4bpp-download-tiles-button');
    var palBtn = document.querySelector('.snes4bpp-download-pal-button');
    var bothBtn = document.querySelector('.snes4bpp-download-both-button');

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
  ns.Snes4bppExportController.prototype.validateAndDisplay_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    // Get current colors and check if over limit
    var colors = pskl.app.currentColorsService.getCurrentColors();
    var colorCount = colors.length;
    var hasTooManyColors = colorCount > MAX_COLORS;

    // Show/hide color warning
    var warning = document.querySelector('.snes4bpp-color-warning');
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
    var paletteBytes = 32;  // 16 colors × 2 bytes

    var tilesInfo = document.querySelector('.snes4bpp-tiles-info');
    var palInfo = document.querySelector('.snes4bpp-pal-info');

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
  ns.Snes4bppExportController.prototype.onDownloadTilesClick_ = function () {
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
  ns.Snes4bppExportController.prototype.onDownloadPaletteClick_ = function () {
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
  ns.Snes4bppExportController.prototype.onDownloadBothClick_ = function () {
    this.onDownloadTilesClick_();
    // Small delay to avoid browser blocking multiple downloads
    setTimeout(this.onDownloadPaletteClick_.bind(this), 100);
  };

  /**
   * Generates the binary 4BPP tile data for all frames.
   * @return {Uint8Array} The 4BPP file bytes
   * @private
   */
  ns.Snes4bppExportController.prototype.generate4bppData_ = function () {
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
   * Generates the binary palette data in SNES BGR555 format.
   * @return {Uint8Array} The palette file bytes (32 bytes)
   * @private
   */
  ns.Snes4bppExportController.prototype.generatePaletteData_ = function () {
    var snesMode = pskl.app.consoleRegistry.get('snes');
    var bytes = new Uint8Array(32);
    var byteIndex = 0;

    for (var i = 0; i < 16; i++) {
      var color = this.paletteColors[i];
      var colorBytes;

      if (i === 0 || color === null) {
        // Transparent: use black (or could use any color)
        colorBytes = new Uint8Array([0, 0]);
      } else if (snesMode) {
        colorBytes = snesMode.colorToRGB555Bytes(color);
      } else {
        // Fallback: simple conversion
        var tc = window.tinycolor(color).toRgb();
        var r5 = Math.round(tc.r * 31 / 255);
        var g5 = Math.round(tc.g * 31 / 255);
        var b5 = Math.round(tc.b * 31 / 255);
        var byte0 = ((g5 & 0x07) << 5) | r5;
        var byte1 = (b5 << 2) | ((g5 >> 3) & 0x03);
        colorBytes = new Uint8Array([byte0, byte1]);
      }

      bytes.set(colorBytes, byteIndex);
      byteIndex += 2;
    }

    return bytes;
  };

  /**
   * Encodes a single 8x8 tile to 32 bytes in SNES 4BPP format.
   *
   * SNES 4BPP uses bitplane interleaved format:
   *   - Bytes 0-15:  BP0 and BP1 interleaved (like 2BPP)
   *   - Bytes 16-31: BP2 and BP3 interleaved
   *
   * For each 16-byte block:
   *   Row0-BPlow, Row0-BPhigh, Row1-BPlow, Row1-BPhigh, ...
   *
   * @param {Uint8ClampedArray} pixels - Full image RGBA data
   * @param {number} imgWidth - Full image width
   * @param {number} startX - Tile start X coordinate
   * @param {number} startY - Tile start Y coordinate
   * @return {Uint8Array} 32 bytes for this tile
   * @private
   */
  ns.Snes4bppExportController.prototype.encodeTile_ = function (
    pixels, imgWidth, startX, startY
  ) {
    var tile = new Uint8Array(32);

    for (var y = 0; y < 8; y++) {
      var bp0 = 0;  // Bitplane 0 (bit 0 of color index)
      var bp1 = 0;  // Bitplane 1 (bit 1 of color index)
      var bp2 = 0;  // Bitplane 2 (bit 2 of color index)
      var bp3 = 0;  // Bitplane 3 (bit 3 of color index)

      for (var x = 0; x < 8; x++) {
        var px = startX + x;
        var py = startY + y;
        var idx = (py * imgWidth + px) * 4;

        var r = pixels[idx];
        var g = pixels[idx + 1];
        var b = pixels[idx + 2];
        var a = pixels[idx + 3];

        var colorIndex = this.getColorIndex_(r, g, b, a);

        // Set bits (MSB first: bit 7 = leftmost pixel)
        var bitPos = 7 - x;
        bp0 |= ((colorIndex & 1) << bitPos);
        bp1 |= (((colorIndex >> 1) & 1) << bitPos);
        bp2 |= (((colorIndex >> 2) & 1) << bitPos);
        bp3 |= (((colorIndex >> 3) & 1) << bitPos);
      }

      // First 16 bytes: BP0 and BP1 interleaved
      tile[y * 2] = bp0;
      tile[y * 2 + 1] = bp1;

      // Last 16 bytes: BP2 and BP3 interleaved
      tile[16 + y * 2] = bp2;
      tile[16 + y * 2 + 1] = bp3;
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
  ns.Snes4bppExportController.prototype.getColorIndex_ = function (
    r, g, b, a
  ) {
    if (a < 128) {
      return 0;
    }

    var colorInt = (255 << 24 >>> 0) + (b << 16) + (g << 8) + r;

    if (this.colorMap.hasOwnProperty(colorInt)) {
      return this.colorMap[colorInt];
    }

    console.warn('Unmapped color during SNES 4BPP export:', r, g, b);
    return 1;
  };

  /**
   * Gets the current piskel name for the filename.
   * @return {string} Piskel name
   * @private
   */
  ns.Snes4bppExportController.prototype.getPiskelName_ = function () {
    return this.piskelController.getPiskel().getDescriptor().name;
  };
})();
