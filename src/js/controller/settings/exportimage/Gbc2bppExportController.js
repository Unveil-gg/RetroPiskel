/**
 * Controller for Game Boy Color 2BPP tile + palette export.
 *
 * 2BPP format: 16 bytes per 8x8 tile (interleaved)
 *   - For each row: low byte (bit 0), then high byte (bit 1)
 *   - 8 rows × 2 bytes = 16 bytes per tile
 *
 * Palette format: 8 bytes per 4-color palette
 *   - Each color is 2 bytes in RGB555 little-endian format
 *   - byte0 = GGGRRRRR, byte1 = 0BBBBBGG
 *
 * Exports:
 *   - .2bpp file: Tile data (all frames concatenated)
 *   - .pal file: Palette data (RGB555 format)
 */
(function () {
  var ns = $.namespace('pskl.controller.settings.exportimage');

  ns.Gbc2bppExportController = function (piskelController) {
    this.piskelController = piskelController;
    this.colorMap = {};  // Maps color int -> index (0-3)
    this.paletteColors = [];  // Array of hex colors in order
  };

  pskl.utils.inherit(ns.Gbc2bppExportController,
    pskl.controller.settings.AbstractSettingController);

  ns.Gbc2bppExportController.prototype.init = function () {
    this.validateAndDisplay_();

    var tilesBtn = document.querySelector('.gbc2bpp-download-tiles-button');
    var palBtn = document.querySelector('.gbc2bpp-download-pal-button');
    var bothBtn = document.querySelector('.gbc2bpp-download-both-button');

    this.addEventListener(tilesBtn, 'click', this.onDownloadTilesClick_);
    this.addEventListener(palBtn, 'click', this.onDownloadPaletteClick_);
    this.addEventListener(bothBtn, 'click', this.onDownloadBothClick_);

    // Listen for color changes to update display
    $.subscribe(Events.CURRENT_COLORS_UPDATED,
      this.validateAndDisplay_.bind(this));
  };

  /**
   * Updates color map and download info display.
   * @private
   */
  ns.Gbc2bppExportController.prototype.validateAndDisplay_ = function () {
    var width = this.piskelController.getWidth();
    var height = this.piskelController.getHeight();
    var frameCount = this.piskelController.getFrameCount();

    // Build color map for export
    var colors = pskl.app.currentColorsService.getCurrentColors();
    this.colorMap = {};
    this.paletteColors = [];
    this.colorMap[0] = 0;  // Transparent maps to index 0
    this.paletteColors.push(null);  // Index 0 = transparent

    for (var i = 0; i < Math.min(colors.length, 3); i++) {
      var colorInt = pskl.utils.colorToInt(colors[i]);
      this.colorMap[colorInt] = i + 1;
      this.paletteColors.push(colors[i]);
    }

    // Pad palette to 4 colors if needed
    while (this.paletteColors.length < 4) {
      this.paletteColors.push('#000000');
    }

    // Update download info
    var tilesPerFrame = (width / 8) * (height / 8);
    var totalTileBytes = frameCount * tilesPerFrame * 16;
    var paletteBytes = 8;  // 4 colors × 2 bytes

    var tilesInfo = document.querySelector('.gbc2bpp-tiles-info');
    var palInfo = document.querySelector('.gbc2bpp-pal-info');

    tilesInfo.innerHTML = totalTileBytes + ' bytes' +
      (frameCount > 1 ? ' (' + frameCount + ' frames)' : '');
    palInfo.innerHTML = paletteBytes + ' bytes (4 colors)';

    // Update palette preview
    this.updatePalettePreview_();
  };

  /**
   * Updates the palette color preview display.
   * @private
   */
  ns.Gbc2bppExportController.prototype.updatePalettePreview_ = function () {
    var preview = document.querySelector('.gbc2bpp-palette-preview');
    if (!preview) {
      return;
    }

    preview.innerHTML = '';
    var gbcMode = pskl.app.consoleRegistry.get('gbc');

    for (var i = 0; i < this.paletteColors.length; i++) {
      var swatch = document.createElement('div');
      swatch.className = 'gbc2bpp-palette-swatch';

      if (i === 0) {
        // Transparent
        swatch.classList.add('transparent');
        swatch.title = 'Index 0: Transparent';
      } else {
        var color = this.paletteColors[i];
        var snapped = gbcMode ? gbcMode.snapColorToRGB555(color) : color;
        swatch.style.backgroundColor = snapped;

        // Show RGB555 values in tooltip
        if (gbcMode) {
          var tc = window.tinycolor(snapped).toRgb();
          var r5 = gbcMode.to5Bit(tc.r);
          var g5 = gbcMode.to5Bit(tc.g);
          var b5 = gbcMode.to5Bit(tc.b);
          swatch.title = 'Index ' + i + ': ' + snapped.toUpperCase() +
            '\nRGB555: R=' + r5 + ' G=' + g5 + ' B=' + b5;
        }
      }

      preview.appendChild(swatch);
    }
  };

  /**
   * Handles tiles download button click.
   * @private
   */
  ns.Gbc2bppExportController.prototype.onDownloadTilesClick_ = function () {
    var data = this.generate2bppData_();
    if (data) {
      var fileName = this.getPiskelName_() + '.2bpp';
      var blob = new Blob([data], {type: 'application/octet-stream'});
      pskl.utils.FileUtils.downloadAsFile(blob, fileName);
    }
  };

  /**
   * Handles palette download button click.
   * @private
   */
  ns.Gbc2bppExportController.prototype.onDownloadPaletteClick_ = function () {
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
  ns.Gbc2bppExportController.prototype.onDownloadBothClick_ = function () {
    this.onDownloadTilesClick_();
    // Small delay to avoid browser blocking multiple downloads
    setTimeout(this.onDownloadPaletteClick_.bind(this), 100);
  };

  /**
   * Generates the binary 2BPP tile data for all frames.
   * @return {Uint8Array} The 2BPP file bytes
   * @private
   */
  ns.Gbc2bppExportController.prototype.generate2bppData_ = function () {
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
   * Generates the binary palette data in GBC RGB555 format.
   * @return {Uint8Array} The palette file bytes (8 bytes)
   * @private
   */
  ns.Gbc2bppExportController.prototype.generatePaletteData_ = function () {
    var gbcMode = pskl.app.consoleRegistry.get('gbc');
    var bytes = new Uint8Array(8);
    var byteIndex = 0;

    for (var i = 0; i < 4; i++) {
      var color = this.paletteColors[i];
      var colorBytes;

      if (i === 0 || color === null) {
        // Transparent: use black (or could use any color)
        colorBytes = new Uint8Array([0, 0]);
      } else if (gbcMode) {
        colorBytes = gbcMode.colorToRGB555Bytes(color);
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
   * Encodes a single 8x8 tile to 16 bytes in Game Boy 2BPP format.
   * Uses INTERLEAVED format (low byte, high byte per row).
   * @param {Uint8ClampedArray} pixels - Full image RGBA data
   * @param {number} imgWidth - Full image width
   * @param {number} startX - Tile start X coordinate
   * @param {number} startY - Tile start Y coordinate
   * @return {Uint8Array} 16 bytes for this tile
   * @private
   */
  ns.Gbc2bppExportController.prototype.encodeTile_ = function (
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

        var colorIndex = this.getColorIndex_(r, g, b, a);

        // Set bits (MSB first: bit 7 = leftmost pixel)
        var bitPos = 7 - x;
        lowByte |= ((colorIndex & 1) << bitPos);
        highByte |= (((colorIndex >> 1) & 1) << bitPos);
      }

      // Interleaved: low byte, then high byte for each row
      tile[byteIdx++] = lowByte;
      tile[byteIdx++] = highByte;
    }

    return tile;
  };

  /**
   * Maps an RGBA pixel to a color index 0-3.
   * @param {number} r - Red component (0-255)
   * @param {number} g - Green component (0-255)
   * @param {number} b - Blue component (0-255)
   * @param {number} a - Alpha component (0-255)
   * @return {number} Color index 0-3
   * @private
   */
  ns.Gbc2bppExportController.prototype.getColorIndex_ = function (r, g, b, a) {
    if (a < 128) {
      return 0;
    }

    var colorInt = (255 << 24 >>> 0) + (b << 16) + (g << 8) + r;

    if (this.colorMap.hasOwnProperty(colorInt)) {
      return this.colorMap[colorInt];
    }

    console.warn('Unmapped color during GBC 2BPP export:', r, g, b);
    return 1;
  };

  /**
   * Gets the current piskel name for the filename.
   * @return {string} Piskel name
   * @private
   */
  ns.Gbc2bppExportController.prototype.getPiskelName_ = function () {
    return this.piskelController.getPiskel().getDescriptor().name;
  };
})();

