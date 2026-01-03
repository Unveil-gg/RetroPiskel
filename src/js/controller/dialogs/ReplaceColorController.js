/**
 * ReplaceColorController - Dialog for choosing which color to replace.
 *
 * When a user hits the console mode color limit (e.g., 3 colors for NES),
 * this dialog presents the current sprite colors and lets them explicitly
 * choose which color to replace with the new one.
 */
(function () {
  var ns = $.namespace('pskl.controller.dialogs');

  /**
   * @param {Object} piskelController - The piskel controller instance
   */
  ns.ReplaceColorController = function (piskelController) {
    this.piskelController = piskelController;
    this.newColor = null;
    this.isPrimary = true;
    this.onColorSelected = null;
    this.onCancel = null;
  };

  pskl.utils.inherit(ns.ReplaceColorController, ns.AbstractDialogController);

  /**
   * Initializes the dialog with the new color and current sprite colors.
   * @param {Object} args - Init arguments
   * @param {string} args.newColor - The new color user wants to use
   * @param {boolean} args.isPrimary - Whether primary color picker triggered
   * @param {Function} args.onColorSelected - Callback when color is chosen
   * @param {Function} args.onCancel - Callback when dialog is cancelled
   */
  ns.ReplaceColorController.prototype.init = function (args) {
    this.superclass.init.call(this);

    this.newColor = args.newColor;
    this.isPrimary = args.isPrimary;
    this.onColorSelected = args.onColorSelected;
    this.onCancel = args.onCancel;

    // Get console mode info
    var consoleMode = pskl.app.consoleRegistry ?
      pskl.app.consoleRegistry.getActive() : null;
    var maxColors = consoleMode ? consoleMode.maxColors : 3;
    var consoleName = consoleMode ? consoleMode.name : 'Console';

    // Update dialog title
    this.setTitle('Replace a Color');

    // Set the limit text
    var limitText = document.querySelector('.replace-color-limit-text');
    if (limitText) {
      limitText.textContent = 'You\'ve reached the ' + maxColors +
        '-color limit for ' + consoleName + '.';
    }

    // Set up new color preview
    var newColorSwatch = document.querySelector('.replace-color-new-swatch');
    if (newColorSwatch) {
      newColorSwatch.style.backgroundColor = this.newColor;
    }
    var newColorHex = document.querySelector('.replace-color-new-hex');
    if (newColorHex) {
      newColorHex.textContent = this.newColor.toUpperCase();
    }

    // Populate current colors grid
    this.populateColorGrid_();

    // Set up cancel button
    var cancelBtn = document.querySelector('.replace-color-cancel');
    this.addEventListener(cancelBtn, 'click', this.onCancel_.bind(this));
  };

  /**
   * Populates the color grid with current sprite colors.
   * @private
   */
  ns.ReplaceColorController.prototype.populateColorGrid_ = function () {
    var grid = document.querySelector('.replace-color-grid');
    if (!grid) {
      return;
    }

    var currentColors = pskl.app.currentColorsService.getCurrentColors();
    var self = this;

    // Get pixel counts for each color
    var pixelCounts = this.getPixelCounts_();

    // Build color cards
    var html = currentColors.map(function (color, index) {
      var normalizedColor = window.tinycolor(color).toHexString().toUpperCase();
      var count = pixelCounts[normalizedColor] || 0;
      var isLight = self.isLightColor_(color);

      return '<div class="replace-color-card' +
        (isLight ? ' light-color' : '') + '" data-color="' + color + '">' +
        '<div class="replace-color-swatch" style="background:' + color +
        '"></div>' +
        '<div class="replace-color-info">' +
        '<span class="replace-color-hex">' + normalizedColor + '</span>' +
        '<span class="replace-color-count">' + count + ' px</span>' +
        '</div>' +
        '</div>';
    }).join('');

    grid.innerHTML = html;

    // Add click handlers
    var cards = grid.querySelectorAll('.replace-color-card');
    cards.forEach(function (card) {
      self.addEventListener(card, 'click', self.onColorCardClick_.bind(self));
    });
  };

  /**
   * Counts pixels for each color in the sprite.
   * @return {Object} Map of normalized color -> pixel count
   * @private
   */
  ns.ReplaceColorController.prototype.getPixelCounts_ = function () {
    var counts = {};
    var layers = this.piskelController.getLayers();

    layers.forEach(function (layer) {
      var frames = layer.getFrames();
      frames.forEach(function (frame) {
        frame.forEachPixel(function (colorInt, col, row) {
          if (colorInt === null || colorInt === 0) {
            return; // Skip transparent
          }
          var hexColor = pskl.utils.intToHex(colorInt).toUpperCase();
          counts[hexColor] = (counts[hexColor] || 0) + 1;
        });
      });
    });

    return counts;
  };

  /**
   * Checks if a color is light (for text contrast).
   * Uses RGB sum threshold matching ColorsList widget.
   * @param {string} color - Hex color string
   * @return {boolean}
   * @private
   */
  ns.ReplaceColorController.prototype.isLightColor_ = function (color) {
    var rgb = window.tinycolor(color).toRgb();
    return rgb.r + rgb.g + rgb.b > 128 * 3;
  };

  /**
   * Handles click on a color card.
   * @param {Event} evt
   * @private
   */
  ns.ReplaceColorController.prototype.onColorCardClick_ = function (evt) {
    var card = evt.target.closest('.replace-color-card');
    if (!card) {
      return;
    }

    var oldColor = card.dataset.color;

    // Close dialog first
    this.closeDialog();

    // Execute callback with selected color
    if (this.onColorSelected) {
      this.onColorSelected(oldColor, this.newColor, this.isPrimary);
    }
  };

  /**
   * Handles cancel button click.
   * @private
   */
  ns.ReplaceColorController.prototype.onCancel_ = function () {
    // Call cancel callback to restore valid state
    if (this.onCancel) {
      this.onCancel(this.isPrimary);
    }
    this.closeDialog();
  };

  /**
   * Cleanup on dialog close.
   */
  ns.ReplaceColorController.prototype.destroy = function () {
    this.superclass.destroy.call(this);
    this.newColor = null;
    this.onColorSelected = null;
    this.onCancel = null;
  };
})();

