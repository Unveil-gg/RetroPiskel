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
    $.subscribe(Events.CONSOLE_MODE_CHANGED,
      this.onConsoleModeChanged_.bind(this));

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
   * Gets the active console mode.
   * @return {Object|null} Active console mode or null
   * @private
   */
  ns.PaletteController.prototype.getActiveConsoleMode_ = function () {
    if (pskl.app.consoleRegistry) {
      return pskl.app.consoleRegistry.getActive();
    }
    return null;
  };

  /**
   * Checks if the active console mode has palette restrictions.
   * @return {boolean}
   * @private
   */
  ns.PaletteController.prototype.hasConsoleRestrictions_ = function () {
    var mode = this.getActiveConsoleMode_();
    return mode && mode.hasRestrictions();
  };

  /**
   * Builds spectrum configuration based on current console mode.
   * @return {Object} Spectrum configuration object
   * @private
   */
  ns.PaletteController.prototype.getSpectrumConfig_ = function () {
    var consoleMode = this.getActiveConsoleMode_();
    var hasPaletteRestriction = consoleMode && consoleMode.palette;

    var config = {
      showPalette: true,
      showButtons: false,
      clickoutFiresChange: true,
      beforeShow: function (tinycolor) {
        tinycolor.setAlpha(1);
      }
    };

    if (hasPaletteRestriction) {
      // Console mode with restricted palette
      config.showPaletteOnly = true;
      config.showInput = false;
      config.palette = this.getConsolePaletteForSpectrum_(consoleMode);
    } else {
      // Standard mode: full color picker
      config.showPaletteOnly = false;
      config.showInput = true;
      config.palette = [['rgba(0,0,0,0)']];
    }

    return config;
  };

  /**
   * Checks if the active console mode uses RGB555 color snapping.
   * @return {boolean}
   * @private
   */
  ns.PaletteController.prototype.isRGB555Mode_ = function () {
    var mode = this.getActiveConsoleMode_();
    return mode && mode.paletteType === 'rgb555';
  };

  /**
   * Snaps a color to RGB555 if in GBC mode.
   * @param {string} color - Hex color string
   * @return {string} Snapped color (or original if not RGB555 mode)
   * @private
   */
  ns.PaletteController.prototype.snapColorIfNeeded_ = function (color) {
    if (color === Constants.TRANSPARENT_COLOR ||
        color === 'rgba(0, 0, 0, 0)') {
      return color;
    }

    var mode = this.getActiveConsoleMode_();
    if (mode && mode.paletteType === 'rgb555' && mode.snapColorToRGB555) {
      return mode.snapColorToRGB555(color);
    }
    return color;
  };

  /**
   * Formats console palette for spectrum (2D array with rows of colors).
   * @param {Object} consoleMode - The active console mode
   * @return {Array} 2D array of color strings
   * @private
   */
  ns.PaletteController.prototype.getConsolePaletteForSpectrum_ = function (
    consoleMode
  ) {
    var colorsPerRow = 14;
    var rows = [];

    // Add transparent as first option
    rows.push(['rgba(0,0,0,0)']);

    // Use console mode's palette formatting if available
    var paletteRows = consoleMode.getPaletteForSpectrum(colorsPerRow);
    if (paletteRows) {
      rows = rows.concat(paletteRows);
    }

    return rows;
  };

  /**
   * Formats NES palette for spectrum picker.
   * @return {Array} 2D array of color strings
   * @private
   */
  ns.PaletteController.prototype.getNESPaletteForSpectrum_ = function () {
    var nesPalette = pskl.consoles.NESConstants.PALETTE;
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
   * Uses palette index position to correctly identify duplicate colors
   * (like the two blacks at $0F and $1F).
   * @private
   */
  ns.PaletteController.prototype.addNESRegisterTooltips_ = function () {
    var paletteData = pskl.consoles.NESConstants.PALETTE_DATA;
    var colorsPerRow = 14;

    // Find all palette rows in the spectrum container
    var paletteRows = document.querySelectorAll('.sp-palette .sp-palette-row');

    paletteRows.forEach(function (row, rowIndex) {
      var swatches = row.querySelectorAll('.sp-thumb-el');

      swatches.forEach(function (swatch, colIndex) {
        var innerEl = swatch.querySelector('.sp-thumb-inner');
        if (!innerEl) {
          return;
        }

        var bgColor = innerEl.style.backgroundColor;
        if (!bgColor) {
          return;
        }

        // Row 0 is transparent, NES colors start at row 1
        if (rowIndex === 0) {
          swatch.title = 'Transparent';
          return;
        }

        // Calculate index into PALETTE_DATA
        // Row 1 = indices 0-13, Row 2 = indices 14-27, etc.
        var paletteIndex = (rowIndex - 1) * colorsPerRow + colIndex;

        if (paletteIndex < paletteData.length) {
          var entry = paletteData[paletteIndex];
          // Format: "rgb(0,0,0) | $0F"
          swatch.title = bgColor + ' | ' + entry.register;
        }
      });
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

    // Add palette tooltips when picker is shown (palette is lazy-rendered)
    var consoleMode = this.getActiveConsoleMode_();
    if (consoleMode && consoleMode.palette) {
      var self = this;
      var addTooltipsOnShow = function () {
        // Small delay to ensure Spectrum has rendered the palette
        setTimeout(function () {
          self.addPaletteTooltips_(consoleMode);
        }, 10);
      };
      colorPicker.off('show.spectrum');
      colorPicker.on('show.spectrum', addTooltipsOnShow);
      secondaryColorPicker.off('show.spectrum');
      secondaryColorPicker.on('show.spectrum', addTooltipsOnShow);
    }
  };

  /**
   * Handles console mode changes.
   * @private
   */
  ns.PaletteController.prototype.onConsoleModeChanged_ = function () {
    this.initColorPickers_();
  };

  /**
   * Adds tooltips to palette swatches based on console mode.
   * @param {Object} consoleMode - The active console mode
   * @private
   */
  ns.PaletteController.prototype.addPaletteTooltips_ = function (consoleMode) {
    // For NES mode, use the register-based tooltips
    if (consoleMode.id === 'nes') {
      this.addNESRegisterTooltips_();
    }
    // GBC mode doesn't use palette swatches - it uses the full picker
  };

  /**
   * Gets RGB555 info string for a color.
   * @param {string} color - Hex color string
   * @return {string} RGB555 info (e.g., "R:31 G:20 B:9")
   * @private
   */
  ns.PaletteController.prototype.getRGB555Info_ = function (color) {
    var mode = this.getActiveConsoleMode_();
    if (!mode || !mode.to5Bit) {
      return '';
    }

    var tc = window.tinycolor(color);
    if (!tc.isValid()) {
      return '';
    }

    var rgb = tc.toRgb();
    var r5 = mode.to5Bit(rgb.r);
    var g5 = mode.to5Bit(rgb.g);
    var b5 = mode.to5Bit(rgb.b);

    return 'R:' + r5 + ' G:' + g5 + ' B:' + b5;
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

      // Snap to RGB555 if in GBC mode
      var originalColor = color;
      color = this.snapColorIfNeeded_(color);

      // Show notification if color was snapped
      if (this.isRGB555Mode_() && originalColor !== color) {
        $.publish(Events.SHOW_NOTIFICATION, [{
          content: 'Color snapped to GBC RGB555: ' + color.toUpperCase(),
          hideDelay: 2000
        }]);
      }
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
    var picker = document.querySelector('#color-picker');
    var currentColor = pskl.app.selectedColorsService.getPrimaryColor();
    var validationResult = this.validateNESColorLimit_(color, true);

    if (validationResult === 'blocked') {
      // Revert picker to current valid color to keep UI in sync
      this.updateColorPicker_(currentColor, picker);
      return;
    }

    if (validationResult === 'replace') {
      // Trigger replacement flow - promptColorReplacement_ handles the rest
      this.promptColorReplacement_(currentColor, color, true);
      return;
    }

    // validationResult === 'allowed'
    this.updateColorPicker_(color, picker);
    $.publish(Events.PRIMARY_COLOR_SELECTED, [color]);
  };

  ns.PaletteController.prototype.setSecondaryColor_ = function (color) {
    var picker = document.querySelector('#secondary-color-picker');
    var currentColor = pskl.app.selectedColorsService.getSecondaryColor();
    var validationResult = this.validateNESColorLimit_(color, false);

    if (validationResult === 'blocked') {
      // Revert picker to current valid color to keep UI in sync
      this.updateColorPicker_(currentColor, picker);
      return;
    }

    if (validationResult === 'replace') {
      // Trigger replacement flow - promptColorReplacement_ handles the rest
      this.promptColorReplacement_(currentColor, color, false);
      return;
    }

    // validationResult === 'allowed'
    this.updateColorPicker_(color, picker);
    $.publish(Events.SECONDARY_COLOR_SELECTED, [color]);
  };

  /**
   * Validates if a color can be used with current console mode limits.
   * Returns 'allowed', 'blocked', or 'replace' to indicate the action.
   * @param {string} color - The color to validate
   * @param {boolean} isPrimary - Whether this is the primary color picker
   * @return {string} 'allowed', 'blocked', or 'replace'
   * @private
   */
  ns.PaletteController.prototype.validateNESColorLimit_ = function (
    color, isPrimary
  ) {
    // Check for console mode restrictions
    var consoleMode = this.getActiveConsoleMode_();
    var maxColors = consoleMode ? consoleMode.maxColors : null;

    // No restrictions if no max colors defined
    if (!maxColors) {
      return 'allowed';
    }

    // Transparent is always allowed
    if (color === Constants.TRANSPARENT_COLOR ||
        color === 'rgba(0, 0, 0, 0)') {
      return 'allowed';
    }

    // Get current colors in the sprite
    var currentColors = pskl.app.currentColorsService.getCurrentColors();
    var consoleName = consoleMode ? consoleMode.name : 'Console';

    // Normalize color for comparison
    var normalizedColor = window.tinycolor(color).toHexString().toUpperCase();

    // Check if color is already in sprite (allowed)
    var colorExists = currentColors.some(function (c) {
      return window.tinycolor(c).toHexString().toUpperCase() === normalizedColor;
    });

    if (colorExists) {
      return 'allowed';
    }

    // New color - check if we're at the limit
    if (currentColors.length >= maxColors) {
      // Check if the currently selected color is in the sprite palette
      // If so, we can offer to replace it
      var selectedColor = isPrimary ?
        pskl.app.selectedColorsService.getPrimaryColor() :
        pskl.app.selectedColorsService.getSecondaryColor();

      // Don't offer replacement for transparent
      if (selectedColor === Constants.TRANSPARENT_COLOR ||
          selectedColor === 'rgba(0, 0, 0, 0)') {
        $.publish(Events.SHOW_NOTIFICATION, [{
          content: consoleName + ': Max ' + maxColors + ' colors allowed. ' +
            'Select a non-transparent color to replace it.',
          hideDelay: 4000
        }]);
        return 'blocked';
      }

      var normalizedSelected = window.tinycolor(selectedColor)
        .toHexString().toUpperCase();
      var selectedInSprite = currentColors.some(function (c) {
        return window.tinycolor(c).toHexString().toUpperCase() ===
          normalizedSelected;
      });

      if (selectedInSprite) {
        // Selected color is in sprite - offer replacement
        return 'replace';
      } else {
        // Selected color is not in sprite - can't replace
        $.publish(Events.SHOW_NOTIFICATION, [{
          content: consoleName + ': Max ' + maxColors + ' colors allowed. ' +
            'Select an existing sprite color to replace it.',
          hideDelay: 4000
        }]);
        return 'blocked';
      }
    }

    return 'allowed';
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
    var displayTitle = parent.dataset.initialTitle + '<br/>' + title;

    // Add RGB555 info for GBC mode
    if (this.isRGB555Mode_() && title !== Constants.TRANSPARENT_COLOR) {
      var rgb555Info = this.getRGB555Info_(title);
      if (rgb555Info) {
        displayTitle += '<br/><span class="rgb555-info">' + rgb555Info +
          '</span>';
      }
    }

    parent.dataset.originalTitle = displayTitle;
  };

  /**
   * Replaces all pixels of oldColor with newColor across all layers/frames.
   * Saves state for undo/redo.
   * @param {string} oldColor - Hex color to replace
   * @param {string} newColor - Hex color to use as replacement
   * @private
   */
  ns.PaletteController.prototype.replaceColorInSprite_ = function (
    oldColor, newColor
  ) {
    var oldColorInt = pskl.utils.colorToInt(oldColor);
    var newColorInt = pskl.utils.colorToInt(newColor);

    var piskelController = pskl.app.piskelController;
    var layers = piskelController.getLayers();

    // Replace color in all layers and frames
    layers.forEach(function (layer) {
      var frames = layer.getFrames();
      frames.forEach(function (frame) {
        frame.forEachPixel(function (color, col, row) {
          if (color !== null && color === oldColorInt) {
            frame.setPixel(col, row, newColorInt);
          }
        });
      });
    });

    // Save state for undo
    $.publish(Events.PISKEL_SAVE_STATE, [{
      type: pskl.service.HistoryService.SNAPSHOT,
      action: 'Color replacement'
    }]);

    // Synchronously update current colors list to avoid async race conditions
    // (the async updateCurrentColors would cause stale data on rapid changes)
    this.syncUpdateCurrentColors_(oldColor, newColor);
  };

  /**
   * Synchronously updates the current colors list after a color replacement.
   * Removes oldColor and adds newColor to the cached color list.
   * @param {string} oldColor - The color that was replaced
   * @param {string} newColor - The new color that replaced it
   * @private
   */
  ns.PaletteController.prototype.syncUpdateCurrentColors_ = function (
    oldColor, newColor
  ) {
    var currentColors = pskl.app.currentColorsService.getCurrentColors();
    var normalizedOld = window.tinycolor(oldColor).toHexString().toUpperCase();
    var normalizedNew = window.tinycolor(newColor).toHexString().toUpperCase();

    // Build new color list: remove old color, add new color if not present
    var newColors = currentColors.filter(function (c) {
      return window.tinycolor(c).toHexString().toUpperCase() !== normalizedOld;
    });

    // Check if new color is already in the list
    var newColorExists = newColors.some(function (c) {
      return window.tinycolor(c).toHexString().toUpperCase() === normalizedNew;
    });

    if (!newColorExists) {
      newColors.push(newColor);
    }

    // Directly set the updated color list (synchronous)
    pskl.app.currentColorsService.setCurrentColors(newColors);
  };

  /**
   * Prompts user to confirm color replacement (if enabled) and executes it.
   * @param {string} oldColor - Currently selected color to replace
   * @param {string} newColor - New color user is trying to use
   * @param {boolean} isPrimary - Whether this is the primary color picker
   * @private
   */
  ns.PaletteController.prototype.promptColorReplacement_ = function (
    oldColor, newColor, isPrimary
  ) {
    // Use new setting, fall back to legacy
    var showPrompt = pskl.UserSettings.get(
      pskl.UserSettings.COLOR_REPLACE_PROMPT);

    var doReplace = function () {
      this.replaceColorInSprite_(oldColor, newColor);

      // Update the selected color to the new color
      if (isPrimary) {
        this.updateColorPicker_(
          newColor, document.querySelector('#color-picker'));
        $.publish(Events.PRIMARY_COLOR_SELECTED, [newColor]);
      } else {
        this.updateColorPicker_(
          newColor, document.querySelector('#secondary-color-picker'));
        $.publish(Events.SECONDARY_COLOR_SELECTED, [newColor]);
      }
    }.bind(this);

    if (showPrompt) {
      var msg = 'Replace color in sprite?\n\n' +
        'All pixels using ' + oldColor.toUpperCase() + ' will be changed to ' +
        newColor.toUpperCase() + '.\n\n' +
        'This applies to all frames and layers.\n\n' +
        'Continue?';

      if (window.confirm(msg)) {
        doReplace();
      } else {
        // User cancelled - revert picker to current color
        var picker = isPrimary ?
          document.querySelector('#color-picker') :
          document.querySelector('#secondary-color-picker');
        this.updateColorPicker_(oldColor, picker);
      }
    } else {
      doReplace();
    }
  };
})();
