(function () {
  var ns = $.namespace('pskl.controller');

  /**
   * The PaletteController is responsible for handling the two color picker
   * widgets found in the left column, below the tools.
   */
  ns.PaletteController = function () {};

  /**
   * @public
   */
  ns.PaletteController.prototype.init = function() {
    $.subscribe(Events.SELECT_PRIMARY_COLOR,
      this.onColorSelected_.bind(this, {isPrimary: true}));
    $.subscribe(Events.SELECT_SECONDARY_COLOR,
      this.onColorSelected_.bind(this, {isPrimary: false}));
    $.subscribe(Events.NES_MODE_CHANGED,
      this.onNESModeChanged_.bind(this));

    var shortcuts = pskl.service.keyboard.Shortcuts;
    pskl.app.shortcutService.registerShortcut(
      shortcuts.COLOR.SWAP, this.swapColors.bind(this));
    pskl.app.shortcutService.registerShortcut(
      shortcuts.COLOR.RESET, this.resetColors.bind(this));

    this.initColorPickers_();

    var swapColorsIcon = document.querySelector('.swap-colors-button');
    swapColorsIcon.addEventListener('click', this.swapColors.bind(this));
  };

  /**
   * Builds spectrum configuration based on current NES mode state.
   * @return {Object} Spectrum configuration object
   * @private
   */
  ns.PaletteController.prototype.getSpectrumConfig_ = function () {
    var isNESMode = pskl.app.nesMode && pskl.app.nesMode.isEnabled();

    var config = {
      showPalette: true,
      showButtons: false,
      clickoutFiresChange: true,
      beforeShow: function (tinycolor) {
        tinycolor.setAlpha(1);
      }
    };

    if (isNESMode) {
      // NES mode: restrict to NES palette only
      config.showPaletteOnly = true;
      config.showInput = false;
      config.palette = this.getNESPaletteForSpectrum_();
    } else {
      // Standard mode: full color picker
      config.showPaletteOnly = false;
      config.showInput = true;
      config.palette = [['rgba(0,0,0,0)']];
    }

    return config;
  };

  /**
   * Formats NES palette for spectrum (2D array with rows of 14 colors).
   * @return {Array} 2D array of color strings
   * @private
   */
  ns.PaletteController.prototype.getNESPaletteForSpectrum_ = function () {
    var nesPalette = pskl.nes.NESColors.PALETTE;
    var rows = [];
    var colorsPerRow = 14;

    // Add transparent as first option
    rows.push(['rgba(0,0,0,0)']);

    // Split NES palette into rows of 14
    for (var i = 0; i < nesPalette.length; i += colorsPerRow) {
      rows.push(nesPalette.slice(i, i + colorsPerRow));
    }

    return rows;
  };

  /**
   * Adds NES register tooltips to spectrum palette swatches.
   * Called after spectrum initialization to enhance color swatches with
   * PPU register info (e.g., "rgb(0,0,0) | $0F / $1F").
   * @private
   */
  ns.PaletteController.prototype.addNESRegisterTooltips_ = function () {
    var swatches = document.querySelectorAll('.sp-palette .sp-thumb-el');
    var nesColors = pskl.nes.NESColors;

    swatches.forEach(function (swatch) {
      var innerEl = swatch.querySelector('.sp-thumb-inner');
      if (!innerEl) {
        return;
      }

      var bgColor = innerEl.style.backgroundColor;
      if (!bgColor) {
        return;
      }

      // Convert rgb(r,g,b) to hex for lookup
      var hex = window.tinycolor(bgColor).toHexString().toUpperCase();
      var register = nesColors.getRegister(hex);

      if (register) {
        // Format: "rgb(124,124,124) | $00"
        swatch.title = bgColor + ' | ' + register;
      }
    });
  };

  /**
   * Initializes or reinitializes the color pickers.
   * @private
   */
  ns.PaletteController.prototype.initColorPickers_ = function () {
    var spectrumCfg = this.getSpectrumConfig_();

    var colorPicker = $('#color-picker');
    var secondaryColorPicker = $('#secondary-color-picker');

    // Destroy existing spectrum instances if they exist
    if (colorPicker.spectrum) {
      try {
        colorPicker.spectrum('destroy');
        secondaryColorPicker.spectrum('destroy');
      } catch (e) {
        // Spectrum not initialized yet, ignore
      }
    }

    // Get current colors or use defaults
    var primaryColor = Constants.DEFAULT_PEN_COLOR;
    var secondaryColor = Constants.TRANSPARENT_COLOR;
    if (pskl.app.selectedColorsService) {
      primaryColor = pskl.app.selectedColorsService.getPrimaryColor();
      secondaryColor = pskl.app.selectedColorsService.getSecondaryColor();
    }

    // Initialize primary color picker
    colorPicker.spectrum($.extend({color: primaryColor}, spectrumCfg));
    colorPicker.off('change.palette');
    colorPicker.on('change.palette', {isPrimary: true},
      this.onPickerChange_.bind(this));
    this.setTitleOnPicker_(primaryColor, colorPicker.get(0));

    // Initialize secondary color picker
    secondaryColorPicker.spectrum(
      $.extend({color: secondaryColor}, spectrumCfg));
    secondaryColorPicker.off('change.palette');
    secondaryColorPicker.on('change.palette', {isPrimary: false},
      this.onPickerChange_.bind(this));
    this.setTitleOnPicker_(secondaryColor, secondaryColorPicker.get(0));

    // Add NES register tooltips if in NES mode
    if (pskl.app.nesMode && pskl.app.nesMode.isEnabled()) {
      // Defer to allow spectrum to render palette swatches
      var self = this;
      setTimeout(function () {
        self.addNESRegisterTooltips_();
      }, 0);
    }
  };

  /**
   * Handles NES mode toggle changes.
   * @private
   */
  ns.PaletteController.prototype.onNESModeChanged_ = function () {
    this.initColorPickers_();
  };

  /**
   * @private
   */
  ns.PaletteController.prototype.onPickerChange_ = function(evt) {
    var inputPicker = evt.target;
    var color = inputPicker.value;

    if (color != Constants.TRANSPARENT_COLOR) {
      // Unless the color is TRANSPARENT_COLOR, format it to hexstring, as
      // expected by the rest of the application.
      color = window.tinycolor(color).toHexString();
    }

    if (evt.data.isPrimary) {
      this.setPrimaryColor_(color);
    } else {
      this.setSecondaryColor_(color);
    }
  };

  /**
   * @private
   */
  ns.PaletteController.prototype.onColorSelected_ = function(args, evt, color) {
    if (args.isPrimary) {
      this.setPrimaryColor_(color);
    } else {
      this.setSecondaryColor_(color);
    }
  };

  ns.PaletteController.prototype.setPrimaryColor_ = function (color) {
    this.updateColorPicker_(color, document.querySelector('#color-picker'));
    $.publish(Events.PRIMARY_COLOR_SELECTED, [color]);
  };

  ns.PaletteController.prototype.setSecondaryColor_ = function (color) {
    this.updateColorPicker_(color, document.querySelector('#secondary-color-picker'));
    $.publish(Events.SECONDARY_COLOR_SELECTED, [color]);
  };

  ns.PaletteController.prototype.swapColors = function () {
    var primaryColor = pskl.app.selectedColorsService.getPrimaryColor();
    this.setPrimaryColor_(pskl.app.selectedColorsService.getSecondaryColor());
    this.setSecondaryColor_(primaryColor);
  };

  ns.PaletteController.prototype.resetColors = function () {
    this.setPrimaryColor_(Constants.DEFAULT_PEN_COLOR);
    this.setSecondaryColor_(Constants.TRANSPARENT_COLOR);
  };

  /**
   * @private
   */
  ns.PaletteController.prototype.updateColorPicker_ = function (color, colorPicker) {
    var jqueryColorPicker = $(colorPicker);
    if (color == Constants.TRANSPARENT_COLOR) {
      // We can set the current palette color to transparent.
      // You can then combine this transparent color with an advanced
      // tool for customized deletions.
      // Eg: bucket + transparent: Delete a colored area
      //     Stroke + transparent: hollow out the equivalent of a stroke

      // The colorpicker can't be set to a transparent state.
      // We set its background to white and insert the
      // string "TRANSPARENT" to mimic this state:
      jqueryColorPicker.spectrum('set', Constants.TRANSPARENT_COLOR);
      colorPicker.value = Constants.TRANSPARENT_COLOR;
    } else {
      jqueryColorPicker.spectrum('set', color);
    }
    this.setTitleOnPicker_(color, colorPicker);
  };

  ns.PaletteController.prototype.setTitleOnPicker_ = function (title, colorPicker) {
    var parent = colorPicker.parentNode;
    title = parent.dataset.initialTitle + '<br/>' + title;
    parent.dataset.originalTitle = title;
  };
})();
